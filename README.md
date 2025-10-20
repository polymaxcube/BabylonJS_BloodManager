# BloodManager for Babylon.js

High-performance blood & impact VFX system for Babylon.js — designed for **fast FPS / survival / horror games** with **object pooling**, **mobile auto-optimization**, and **pre-loaded textures** (no runtime lag).

---

## ✅ Usage

```ts
// 1) Initialize once (e.g. inside createScene)
this.bloodManager = new BloodManager(scene, {
  poolSize: 6,                  // how many pooled particle systems
  allowAutoGrow: true,          // automatically expand pool if needed
  preloadTexturePath: "textures/blood/green_blood.webp",
  lowSpecAutoDetect: true,      // auto-reduce effect if low-end device
});

// 2) Spawn blood fountain from pool
this.bloodManager.spawnBloodFountainPool(
  picked,             // mesh that got hit
  hit.pickedPoint!,   // world-space hit position
  3.5,                // intensity (0.1–5 recommended)
);


https://crowbarhunt.online/
