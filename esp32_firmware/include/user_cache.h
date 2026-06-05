#pragma once
#include <Arduino.h>
#include "config.h"

// ╔══════════════════════════════════════════════════════╗
// ║   user_cache.h — Firebase থেকে আসা User Data Cache  ║
// ╚══════════════════════════════════════════════════════╝
// Users এখন cards.h তে নয়, Firebase /rfid/users/ এ রাখো
// Admin Panel থেকে add/edit/delete করা যাবে
// ESP32 boot এ এবং প্রতি ৫ মিনিটে refresh করবে

struct User {
    char     uid[24];          // "A3:B2:C1:D0"
    char     name[40];         // "Rahim Ahmed"
    char     role[16];         // "Admin" / "Staff" / "Guest"
    bool     active;           // false হলে deny করবে
    uint8_t  startHour;        // allowed start hour (0-23)
    uint8_t  startMin;         // allowed start minute
    uint8_t  endHour;          // allowed end hour
    uint8_t  endMin;           // allowed end minute
    bool     days[7];          // [Mon,Tue,Wed,Thu,Fri,Sat,Sun] true=allowed
};

// Global user cache
User  userCache[MAX_USERS];
int   userCount = 0;

// UID → cache index, না পেলে -1
inline int findUser(const String& uid) {
    for (int i = 0; i < userCount; i++) {
        if (String(userCache[i].uid) == uid) return i;
    }
    return -1;
}

// UID bytes → "A3:B2:C1:D0" format string
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

// "A3:B2:C1:D0" → Firebase key safe "A3B2C1D0"
inline String uidToKey(const String& uid) {
    String k = uid;
    k.replace(":", "");
    return k;
}

// Default user (fallback) — সব time allowed, Admin
inline void setDefaultUser(User& u, const String& uid, const String& name) {
    strncpy(u.uid,  uid.c_str(),  23);
    strncpy(u.name, name.c_str(), 39);
    strncpy(u.role, "Admin",      15);
    u.active     = true;
    u.startHour  = 0;  u.startMin = 0;
    u.endHour    = 23; u.endMin   = 59;
    for (int i = 0; i < 7; i++) u.days[i] = true;
}
