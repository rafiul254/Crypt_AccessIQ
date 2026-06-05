#pragma once
#include <Arduino.h>
#include "config.h"
struct User {
    char     uid[24];         
    char     name[40];       
    char     role[16];       
    bool     active;     
    uint8_t  startHour;     
    uint8_t  startMin;       
    uint8_t  endHour;         
    uint8_t  endMin;          
    bool     days[7];       
};

User  userCache[MAX_USERS];
int   userCount = 0;


inline int findUser(const String& uid) {
    for (int i = 0; i < userCount; i++) {
        if (String(userCache[i].uid) == uid) return i;
    }
    return -1;
}

inline String uidToStr(const uint8_t* uid, uint8_t len) {
    String s = "";
    for (uint8_t i = 0; i < len; i++) {
        if (uid[i] < 0x10) s += "0";
        s += String(uid[i], HEX);
        if (i < len - 1) s += ":";
    }
    s.toUpperCase();
    return s;
}

inline String uidToKey(const String& uid) {
    String k = uid;
    k.replace(":", "");
    return k;
}


inline void setDefaultUser(User& u, const String& uid, const String& name) {
    strncpy(u.uid,  uid.c_str(),  23);
    strncpy(u.name, name.c_str(), 39);
    strncpy(u.role, "Admin",      15);
    u.active     = true;
    u.startHour  = 0;  u.startMin = 0;
    u.endHour    = 23; u.endMin   = 59;
    for (int i = 0; i < 7; i++) u.days[i] = true;
}
