#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <MFRC522.h>
#include <Firebase_ESP_Client.h>
#include <TFT_eSPI.h>
#include <ArduinoJson.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "config.h"
#include "user_cache.h"

MFRC522      rfid(PIN_RFID_SS, PIN_RFID_RST);
TFT_eSPI     tft = TFT_eSPI();
FirebaseData fbdo, fbdo2;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;
WiFiUDP      ntpUDP;
NTPClient    timeClient(ntpUDP, NTP_SERVER, NTP_OFFSET, NTP_INTERVAL);

bool     wifiOK = false, fbOK = false, isAlarming = false;
int      wrongCount = 0;
uint32_t wrongFirstMs = 0;
long     logIdx = 0;
String   lastUID = "";
uint32_t lastScanMs = 0, lastRefreshMs = 0;

#define C_BG      0x0000
#define C_WHITE   0xFFFF
#define C_CYAN    0x07FF
#define C_GREEN   0x07E0
#define C_DKGREEN 0x03E0
#define C_RED     0xF800
#define C_DKRED   0x7800
#define C_YELLOW  0xFFE0
#define C_ORANGE  0xFC00
#define C_GRAY    0x39E7
#define C_DKGRAY  0x18C3

void connectWiFi(); void initFirebase(); void syncNTP(); void loadUsers();
bool checkTimeAccess(const User& u); void handleScan(const String& uid);
void logToFirebase(String uid, String name, String role, String status, String reason);
void updateAttendance(const String& uid, const String& name, const String& role);
void handleWrongAttempt(const String& uid); void resetWrongAttempts(); void triggerAlarm();
String getDateStr(); String getTimeStr(); int getDayOfWeek();
void tftBoot(); void tftConnecting(const String& msg); void tftReady();
void tftGranted(const char* name, const char* role, bool isEntry, const String& t);
void tftDenied(const String& uid, const String& reason);
void tftAlarm(); void tftNoAccess(const char* name, const String& reason);
void drawTopBar(); void beepGranted(); void beepDenied(); void beepAlarm();

// ================================================================
// SETUP
// ================================================================
void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println("\n[BOOT] Crypt_AccessIQ starting...");

    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);

    pinMode(27, OUTPUT); digitalWrite(27, HIGH);
    pinMode(21, OUTPUT); digitalWrite(21, HIGH);
    pinMode(15, OUTPUT); digitalWrite(15, HIGH);
    pinMode(4,  OUTPUT); digitalWrite(4,  HIGH);
    Serial.println("[SPI] All CS pins HIGH");
    delay(100);

    tft.init();
    tft.setRotation(0);
    tft.startWrite();
    tft.writecommand(0x36);
    tft.writedata(0x08);
    tft.endWrite();
    tft.fillScreen(C_BG);
    tftBoot();
    Serial.println("[TFT] Init done");

    digitalWrite(15, HIGH);
    delay(100);

    Serial.println("[RC522] Hardware reset...");
    pinMode(PIN_RFID_RST, OUTPUT);
    digitalWrite(PIN_RFID_RST, LOW);
    delay(100);
    digitalWrite(PIN_RFID_RST, HIGH);
    delay(100);

    SPI.begin(18, 19, 23, PIN_RFID_SS);
    rfid.PCD_Init();
    delay(200);
    rfid.PCD_SetAntennaGain(rfid.RxGain_max);
    delay(50);

    byte rfidVer = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("[RC522] Version: 0x%02X\n", rfidVer);

    rfid.PCD_WriteRegister(MFRC522::FIFODataReg, 0x55);
    byte spiTest = rfid.PCD_ReadRegister(MFRC522::FIFODataReg);
    if (spiTest == 0x55) {
        Serial.println("[RC522] SPI OK! Write/Read test passed");
    } else {
        Serial.printf("[RC522] SPI FAIL! Wrote 0x55, Read 0x%02X\n", spiTest);
        Serial.println("  >>> Check MOSI(GPIO23) and MISO(GPIO19) wires!");
        Serial.println("  >>> They might be SWAPPED on the breadboard!");
    }

    tftConnecting("Connecting WiFi...");
    connectWiFi();
    if (wifiOK) {
        tftConnecting("Syncing time...");
        syncNTP();
        tftConnecting("Connecting Firebase...");
        initFirebase();
        if (fbOK) { tftConnecting("Loading users..."); loadUsers(); }
    }

    tftReady();
    Serial.println("[BOOT] Ready!");
    Serial.println(">>> Scan the card <<<");
}

// ================================================================
// LOOP
// ================================================================
void loop() {
    if (fbOK && millis() - lastRefreshMs > USER_REFRESH_MS) {
        loadUsers(); lastRefreshMs = millis();
    }

    if (wifiOK) timeClient.update();

    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
        delay(50); return;
    }
    String uid = uidToStr(rfid.uid.uidByte, rfid.uid.size);
    if (uid == lastUID && (millis() - lastScanMs) < DEBOUNCE_MS) {
        rfid.PICC_HaltA(); rfid.PCD_StopCrypto1(); return;
    }
    lastUID = uid; lastScanMs = millis();
    Serial.printf("\n[SCAN] UID: %s  Time: %s\n", uid.c_str(), getTimeStr().c_str());
    handleScan(uid);
    rfid.PICC_HaltA(); rfid.PCD_StopCrypto1();
    delay(300); tftReady();
}

// ================================================================
// HANDLE SCAN
// ================================================================
void handleScan(const String& uid) {
    int idx = findUser(uid);
    if (idx < 0) {
        Serial.println("[ACCESS] DENIED - Unknown");
        tftDenied(uid, "Unknown Card"); beepDenied();
        logToFirebase(uid, "Unknown", "NONE", "DENIED", "Unknown card");
        handleWrongAttempt(uid); return;
    }
    const User& u = userCache[idx];
    if (!u.active) {
        tftNoAccess(u.name, "Card Deactivated"); beepDenied();
        logToFirebase(uid, u.name, u.role, "DENIED", "Inactive");
        handleWrongAttempt(uid); return;
    }
    if (!checkTimeAccess(u)) {
        tftNoAccess(u.name, "Outside allowed hours"); beepDenied();
        logToFirebase(uid, u.name, u.role, "DENIED", "Outside hours");
        handleWrongAttempt(uid); return;
    }
    resetWrongAttempts();
    String attPath = String("/rfid/attendance/") + getDateStr() + String("/") + uidToKey(uid);
    bool hasEntry = false, hasExit = false;
    if (fbOK) {
        if (Firebase.RTDB.getString(&fbdo2, attPath+"/entry")) hasEntry = fbdo2.stringData().length() > 0;
        if (Firebase.RTDB.getString(&fbdo2, attPath+"/exit"))  hasExit  = fbdo2.stringData().length() > 0;
    }
    bool isEntry = !(hasEntry && !hasExit);
    Serial.printf("[ACCESS] GRANTED - %s [%s]\n", u.name, isEntry?"ENTRY":"EXIT");
    tftGranted(u.name, u.role, isEntry, getTimeStr());
    beepGranted();
    logToFirebase(uid, u.name, u.role, "GRANTED", isEntry?"Entry":"Exit");
    updateAttendance(uid, u.name, u.role);
    delay(DOOR_OPEN_MS);
}

bool checkTimeAccess(const User& u) {
    if (!wifiOK) return true;
    if (!u.days[getDayOfWeek()]) return false;
    int cur = timeClient.getHours()*60 + timeClient.getMinutes();
    return (cur >= u.startHour*60+u.startMin && cur <= u.endHour*60+u.endMin);
}

void updateAttendance(const String& uid, const String& name, const String& role) {
    if (!fbOK) return;
    String path = String("/rfid/attendance/") + getDateStr() + String("/") + uidToKey(uid);
    String entryTime="", exitTime="", timeNow=getTimeStr();
    if (Firebase.RTDB.getString(&fbdo2,path+"/entry")) entryTime=fbdo2.stringData();
    if (Firebase.RTDB.getString(&fbdo2,path+"/exit"))  exitTime =fbdo2.stringData();
    if (entryTime.length()==0) {
        Firebase.RTDB.setString(&fbdo,path+"/uid",uid);
        Firebase.RTDB.setString(&fbdo,path+"/name",name);
        Firebase.RTDB.setString(&fbdo,path+"/role",role);
        Firebase.RTDB.setString(&fbdo,path+"/entry",timeNow);
        Firebase.RTDB.setString(&fbdo,path+"/exit","");
        Firebase.RTDB.setString(&fbdo,path+"/duration","");
        Firebase.RTDB.setString(&fbdo,path+"/status","In");
        Serial.println("[ATT] Entry: "+timeNow);
    } else if (exitTime.length()==0) {
        Firebase.RTDB.setString(&fbdo,path+"/exit",timeNow);
        Firebase.RTDB.setString(&fbdo,path+"/status","Out");
        int eH=entryTime.substring(0,2).toInt(), eM=entryTime.substring(3,5).toInt();
        int xH=timeNow.substring(0,2).toInt(),   xM=timeNow.substring(3,5).toInt();
        int totalMin=(xH*60+xM)-(eH*60+eM); if(totalMin<0) totalMin+=1440;
        String dur=String(totalMin/60)+"h "+String(totalMin%60)+"m";
        Firebase.RTDB.setString(&fbdo,path+"/duration",dur);
        Serial.println("[ATT] Exit: "+timeNow+" | "+dur);
    } else {
        Firebase.RTDB.setString(&fbdo,path+"/entry",timeNow);
        Firebase.RTDB.setString(&fbdo,path+"/exit","");
        Firebase.RTDB.setString(&fbdo,path+"/duration","");
        Firebase.RTDB.setString(&fbdo,path+"/status","In");
        Serial.println("[ATT] New cycle: "+timeNow);
    }
}

void logToFirebase(String uid, String name, String role, String status, String reason) {
    if (!fbOK) return;
    String path=String("/rfid/logs/")+String(logIdx++);
    Firebase.RTDB.setString(&fbdo,path+"/uid",uid);
    Firebase.RTDB.setString(&fbdo,path+"/name",name);
    Firebase.RTDB.setString(&fbdo,path+"/role",role);
    Firebase.RTDB.setString(&fbdo,path+"/status",status);
    Firebase.RTDB.setString(&fbdo,path+"/reason",reason);
    Firebase.RTDB.setString(&fbdo,path+"/time",getTimeStr());
    Firebase.RTDB.setString(&fbdo,path+"/date",getDateStr());
    Firebase.RTDB.setString(&fbdo,"/rfid/latest/uid",uid);
    Firebase.RTDB.setString(&fbdo,"/rfid/latest/name",name);
    Firebase.RTDB.setString(&fbdo,"/rfid/latest/role",role);
    Firebase.RTDB.setString(&fbdo,"/rfid/latest/status",status);
    Firebase.RTDB.setString(&fbdo,"/rfid/latest/time",getTimeStr());
    Serial.printf("[FB] %s -> %s\n",name.c_str(),status.c_str());
}

void handleWrongAttempt(const String& uid) {
    uint32_t now=millis();
    if (wrongCount>0&&(now-wrongFirstMs)>WRONG_ATTEMPT_WINDOW) wrongCount=0;
    if (wrongCount==0) wrongFirstMs=now; wrongCount++;
    Serial.printf("[SEC] %d/%d\n",wrongCount,WRONG_ATTEMPT_MAX);
    if (fbOK) {
        Firebase.RTDB.setInt(&fbdo,"/rfid/security/wrongAttempts",wrongCount);
        Firebase.RTDB.setString(&fbdo,"/rfid/security/lastDeniedUID",uid);
        Firebase.RTDB.setString(&fbdo,"/rfid/security/lastDeniedTime",getTimeStr());
    }
    if (wrongCount>=WRONG_ATTEMPT_MAX) triggerAlarm();
}

void resetWrongAttempts() {
    if (wrongCount>0) { wrongCount=0; if(fbOK) Firebase.RTDB.setInt(&fbdo,"/rfid/security/wrongAttempts",0); }
}

void triggerAlarm() {
    Serial.println("[SEC] ALARM!"); isAlarming=true; tftAlarm();
    if (fbOK) {
        Firebase.RTDB.setBool(&fbdo,"/rfid/security/alarmActive",true);
        Firebase.RTDB.setString(&fbdo,"/rfid/security/alarmTime",getTimeStr());
    }
    beepAlarm(); isAlarming=false; wrongCount=0;
    if (fbOK) Firebase.RTDB.setBool(&fbdo,"/rfid/security/alarmActive",false);
}

void loadUsers() {
    if (!Firebase.RTDB.getJSON(&fbdo2,"/rfid/users")) { Serial.println("[USERS] Failed"); return; }
    String json=fbdo2.stringData();
    if (json.length()<5) { Serial.println("[USERS] Empty"); return; }
    StaticJsonDocument<8192> doc;
    if (deserializeJson(doc,json)) { Serial.println("[USERS] JSON error"); return; }
    userCount=0;
    for (JsonPair kv:doc.as<JsonObject>()) {
        if (userCount>=MAX_USERS) break;
        User& u=userCache[userCount];
        String key=kv.key().c_str(), uid="";
        for(int i=0;i<(int)key.length();i+=2){uid+=key.substring(i,i+2);if(i+2<(int)key.length())uid+=":";}
        strncpy(u.uid,uid.c_str(),23);
        JsonObject obj=kv.value().as<JsonObject>();
        strncpy(u.name,obj["name"]|"Unknown",39); strncpy(u.role,obj["role"]|"Staff",15);
        u.active=obj["active"]|true; u.startHour=obj["startHour"]|0; u.startMin=obj["startMin"]|0;
        u.endHour=obj["endHour"]|23; u.endMin=obj["endMin"]|59;
        JsonArray days=obj["days"];
        for(int i=0;i<7;i++) u.days[i]=days.isNull()?true:(bool)days[i];
        userCount++;
    }
    Serial.printf("[USERS] Loaded %d\n",userCount);
}

void connectWiFi() {
    WiFi.begin(WIFI_SSID,WIFI_PASSWORD); int t=0;
    while(WiFi.status()!=WL_CONNECTED&&t<20){delay(500);Serial.print(".");t++;}
    wifiOK=(WiFi.status()==WL_CONNECTED);
    Serial.println(wifiOK?"\n[WiFi] "+WiFi.localIP().toString():"\n[WiFi] Offline");
}

void initFirebase() {
    fbConfig.api_key=FIREBASE_API_KEY; fbConfig.database_url=FIREBASE_DATABASE_URL;
    fbConfig.token_status_callback=tokenStatusCallback;
    if(Firebase.signUp(&fbConfig,&fbAuth,"","")) Serial.println("[FB] Sign-up OK");
    else Serial.printf("[FB] Error: %s\n",fbConfig.signer.signupError.message.c_str());
    Firebase.begin(&fbConfig,&fbAuth); Firebase.reconnectWiFi(true);
    Serial.print("[FB] Waiting"); int w=0;
    while(!Firebase.ready()&&w++<15){delay(500);Serial.print(".");}
    Serial.println(); fbOK=Firebase.ready();
    Serial.println(fbOK?"[FB] Ready":"[FB] Failed");
}

void syncNTP() {
    timeClient.begin(); timeClient.update();
    Serial.printf("[NTP] %s\n",timeClient.getFormattedTime().c_str());
}

String getTimeStr() { return wifiOK?timeClient.getFormattedTime():"00:00:00"; }
String getDateStr() {
    unsigned long e=timeClient.getEpochTime(); struct tm* t=gmtime((time_t*)&e);
    char buf[12]; sprintf(buf,"%04d-%02d-%02d",t->tm_year+1900,t->tm_mon+1,t->tm_mday);
    return String(buf);
}
int getDayOfWeek() { int d=timeClient.getDay(); return (d==0)?6:d-1; }

void drawTopBar() {
    tft.fillRect(0,0,240,22,C_DKGRAY); tft.setTextSize(1);
    tft.setTextColor(wifiOK?C_GREEN:C_RED,C_DKGRAY); tft.setCursor(4,7);   tft.print(wifiOK?"WiFi:OK":"WiFi:--");
    tft.setTextColor(fbOK?C_GREEN:C_GRAY,C_DKGRAY);  tft.setCursor(80,7);  tft.print(fbOK?"FB:OK":"FB:--");
    tft.setTextColor(C_GRAY,C_DKGRAY); tft.setCursor(156,7); tft.print(getTimeStr());
}
void tftBoot() {
    tft.fillScreen(C_BG); tft.fillRect(0,0,240,90,0x0010);
    tft.setTextColor(C_CYAN,0x0010); tft.setTextSize(3); tft.setCursor(20,15); tft.println("Crypt");
    tft.setTextColor(C_WHITE,0x0010); tft.setTextSize(2); tft.setCursor(20,58); tft.println("AccessIQ");
    tft.drawFastHLine(0,90,240,C_CYAN); tft.setTextSize(1); tft.setTextColor(C_GRAY,C_BG);
    tft.setCursor(10,102); tft.println("ESP32 + Firebase + RFID");
    tft.setCursor(10,118); tft.println("v2.0  IoT Access Control");
    tft.setTextColor(C_CYAN,C_BG); tft.setCursor(10,280); tft.println("Initializing...");
}
void tftConnecting(const String& msg) {
    tft.fillRect(0,270,240,30,C_BG); tft.setTextSize(1);
    tft.setTextColor(C_CYAN,C_BG); tft.setCursor(10,278); tft.println(msg);
}
void tftReady() {
    tft.fillScreen(C_BG); drawTopBar();
    tft.setTextColor(C_CYAN,C_BG); tft.setTextSize(2); tft.setCursor(10,36); tft.println("RFID SYSTEM");
    tft.drawFastHLine(0,60,240,C_DKGRAY);
    tft.setTextSize(1); tft.setTextColor(C_WHITE,C_BG); tft.setCursor(10,74); tft.println("Scan your card...");
    tft.setTextColor(C_GRAY,C_BG); tft.setCursor(10,92);
    tft.printf("%d users  |  %s",userCount,getDateStr().c_str());
    tft.drawFastHLine(0,108,240,C_DKGRAY);
    tft.drawCircle(120,190,40,C_CYAN); tft.drawCircle(120,190,28,C_CYAN);
    tft.drawCircle(120,190,16,C_CYAN); tft.fillCircle(120,190,6,C_CYAN);
    tft.setTextColor(C_CYAN,C_BG); tft.setTextSize(1); tft.setCursor(98,248); tft.println("READY");
    tft.setTextColor(C_DKGRAY,C_BG); tft.setCursor(10,305); tft.println(getTimeStr());
}
void tftGranted(const char* name, const char* role, bool isEntry, const String& t) {
    tft.fillScreen(C_BG); tft.fillRect(0,0,240,70,C_DKGREEN);
    tft.setTextColor(C_WHITE,C_DKGREEN); tft.setTextSize(2); tft.setCursor(10,12);
    tft.println(isEntry?"ENTRY OK!":"EXIT  OK!");
    tft.setTextSize(1); tft.setTextColor(C_GREEN,C_DKGREEN); tft.setCursor(10,50);
    tft.println(isEntry?"Access Granted":"Goodbye!");
    tft.drawFastHLine(0,70,240,C_GREEN);
    tft.setTextSize(1); tft.setTextColor(C_GRAY,C_BG); tft.setCursor(10,88);
    tft.println(isEntry?"Welcome,":"Goodbye,");
    tft.setTextSize(2); tft.setTextColor(C_WHITE,C_BG); tft.setCursor(10,104); tft.println(name);
    tft.drawFastHLine(0,130,240,C_DKGRAY); tft.setTextSize(1); tft.setTextColor(C_GRAY,C_BG);
    tft.setCursor(10,146); tft.printf("Role:  %s",role);
    tft.setCursor(10,166); tft.printf("Time:  %s",t.c_str());
    tft.setCursor(10,186); tft.printf("Date:  %s",getDateStr().c_str());
    tft.drawFastHLine(0,202,240,C_DKGRAY);
    tft.setTextColor(fbOK?C_GREEN:C_GRAY,C_BG); tft.setCursor(10,218);
    tft.println(fbOK?"Cloud: Synced":"Cloud: Offline");
    tft.fillCircle(120,278,22,C_DKGREEN);
    tft.setTextColor(C_WHITE,C_DKGREEN); tft.setTextSize(2); tft.setCursor(111,270); tft.println("OK");
}
void tftDenied(const String& uid, const String& reason) {
    tft.fillScreen(C_BG); tft.fillRect(0,0,240,70,C_DKRED);
    tft.setTextColor(C_WHITE,C_DKRED); tft.setTextSize(2); tft.setCursor(10,12); tft.println("ACCESS");
    tft.setTextColor(C_RED,C_DKRED); tft.setCursor(10,38); tft.println("DENIED!");
    tft.drawFastHLine(0,70,240,C_RED); tft.setTextSize(1); tft.setTextColor(C_WHITE,C_BG);
    tft.setCursor(10,86); tft.println("Reason:"); tft.setTextColor(C_RED,C_BG);
    tft.setCursor(10,102); tft.println(reason);
    tft.drawFastHLine(0,118,240,C_DKGRAY); tft.setTextColor(C_GRAY,C_BG);
    tft.setCursor(10,132); tft.println("Card UID:"); tft.setTextColor(C_RED,C_BG);
    tft.setCursor(10,148); tft.println(uid);
    tft.drawFastHLine(0,165,240,C_DKGRAY); tft.setTextColor(C_YELLOW,C_BG);
    tft.setCursor(10,180); tft.printf("Attempts: %d / %d",wrongCount,WRONG_ATTEMPT_MAX);
}
void tftNoAccess(const char* name, const String& reason) {
    tft.fillScreen(C_BG); tft.fillRect(0,0,240,70,0x4208);
    tft.setTextColor(C_ORANGE,0x4208); tft.setTextSize(2); tft.setCursor(10,12); tft.println("NO ACCESS");
    tft.setTextSize(1); tft.setTextColor(C_YELLOW,0x4208); tft.setCursor(10,50); tft.println("Access Restricted");
    tft.drawFastHLine(0,70,240,C_ORANGE); tft.setTextSize(2); tft.setTextColor(C_WHITE,C_BG);
    tft.setCursor(10,88); tft.println(name); tft.drawFastHLine(0,114,240,C_DKGRAY);
    tft.setTextSize(1); tft.setTextColor(C_ORANGE,C_BG); tft.setCursor(10,130); tft.println("Reason:");
    tft.setTextColor(C_WHITE,C_BG); tft.setCursor(10,148); tft.println(reason);
    tft.setTextColor(C_GRAY,C_BG); tft.setCursor(10,200); tft.println("Contact administrator");
}
void tftAlarm() {
    tft.fillScreen(C_RED); tft.setTextColor(C_WHITE,C_RED); tft.setTextSize(3);
    tft.setCursor(30,80); tft.println("ALARM!"); tft.setTextSize(2);
    tft.setCursor(10,140); tft.println("Security Alert!"); tft.setTextSize(1);
    tft.setCursor(10,180); tft.println("Multiple failed attempts");
    tft.setCursor(10,200); tft.printf("Time: %s",getTimeStr().c_str());
}
void beepGranted() {
    digitalWrite(PIN_BUZZER,HIGH);delay(80);digitalWrite(PIN_BUZZER,LOW);delay(80);
    digitalWrite(PIN_BUZZER,HIGH);delay(80);digitalWrite(PIN_BUZZER,LOW);delay(80);
    digitalWrite(PIN_BUZZER,HIGH);delay(200);digitalWrite(PIN_BUZZER,LOW);
}
void beepDenied() {
    for(int i=0;i<3;i++){digitalWrite(PIN_BUZZER,HIGH);delay(250);digitalWrite(PIN_BUZZER,LOW);delay(150);}
}
void beepAlarm() {
    uint32_t end=millis()+ALARM_DURATION;
    while(millis()<end){digitalWrite(PIN_BUZZER,HIGH);delay(100);digitalWrite(PIN_BUZZER,LOW);delay(100);}
    digitalWrite(PIN_BUZZER,LOW);
}
