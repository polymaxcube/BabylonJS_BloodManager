// █████████████████████████████████████████████
// █░██░██░ BLOOD MANAGER SYSTEM | Author: Samiti Aekkornpong ░██░██░█
// █ โหมดดาร์ก • เอฟเฟคเลือด • Babylon.js █
// █████████████████████████████████████████████
import {
  Scene,
  Texture,
  ParticleSystem,
  MeshBuilder,
  AbstractMesh,
  Vector3,
  Color4,
  Nullable,
  Scalar,
} from "@babylonjs/core";

// อินเตอร์เฟสสำหรับเก็บแต่ละ Pool Item (แต่ละเอฟเฟคเลือด)
interface PoolItem {
  ps: ParticleSystem;
  emitter: AbstractMesh | Vector3;
  inUse: boolean;
  releaseAt: number;
}

// ใช้กำหนดสีหรือ texture ของเลือด
interface ColorOrTexture {
  color1?: Color4;
  color2?: Color4;
  particleTexture?: Texture;
}

interface BloodManagerOptions {
  poolSize?: number; // จำนวน effect สูงสุดใน pool
  allowAutoGrow?: boolean; // ถ้า pool เต็ม อนุญาตให้สร้างเพิ่มไหม
  preloadTexturePath?: string; // path ของ texture ที่ใช้ preload
  lowSpecAutoDetect?: boolean; // ตรวจจับเครื่อง low spec หรือไม่
  lowSpecThreshold?: number; // threshold สำหรับตัดสินว่า low spec
  defaultLifetimeMs?: number; // อายุของอนุภาคแต่ละตัว (ms)
}

export class BloodManager {
  private scene: Scene;
  private pool: PoolItem[] = []; // เก็บ pool ของเอฟเฟคเลือด
  private _bloodTexture: Texture; // texture หลักของเลือด
  private options: Required<BloodManagerOptions>; // เก็บ options ที่ merge ค่า default แล้ว
  private lowSpecMode: boolean = false; // flag ว่าเป็นโหมด low spec หรือไม่

  constructor(scene: Scene, opts?: BloodManagerOptions) {
    this.scene = scene;
    this.options = {
      poolSize: opts?.poolSize ?? 5,
      allowAutoGrow: opts?.allowAutoGrow ?? true,
      preloadTexturePath:
        opts?.preloadTexturePath ?? "textures/blood/green_blood.webp",
      lowSpecAutoDetect: opts?.lowSpecAutoDetect ?? true,
      lowSpecThreshold: opts?.lowSpecThreshold ?? 1.5,
      defaultLifetimeMs: opts?.defaultLifetimeMs ?? 800,
    };

    this._bloodTexture = new Texture(this.options.preloadTexturePath, scene);

    if (this.options.lowSpecAutoDetect) {
      try {
        const engineAny: any = scene.getEngine?.();
        const scale =
          engineAny?.getHardwareScalingLevel?.() ??
          window.devicePixelRatio ??
          1;
        this.lowSpecMode = scale > this.options.lowSpecThreshold;
      } catch {}
    }

    for (let i = 0; i < this.options.poolSize; i++) {
      this.pool.push(this._createPoolItem());
    }

    //  ตรวจทุกเฟรมก่อน Render ว่าเลือดไหนหมดแล้ว ให้แจ้งสถานะหยุด
    this.scene.onBeforeRenderObservable.add(() => {
      const now = Date.now();
      for (const item of this.pool) {
        if (item.inUse && item.releaseAt <= now) {
          this._releasePoolItem(item);
        }
      }
    });
  }

  public spawn(
    mesh: AbstractMesh,
    hitPoint?: Vector3,
    intensity = 0.1,
    colorOrTexture?: ColorOrTexture,
    yOffset = 0
  ): Nullable<ParticleSystem> {
    if (!mesh || !mesh.getScene()) return null;
    const scene = mesh.getScene();

    if (!hitPoint)
      hitPoint = mesh.getBoundingInfo().boundingBox.centerWorld.clone();

    // get free pooled particle system
    let item = this.pool.find((p) => !p.inUse);
    if (!item && this.options.allowAutoGrow) {
      item = this._createPoolItem();
      this.pool.push(item);
    }
    if (!item) return null;

    item.inUse = true;

    // Place emitter exactly at hit point
    let emitterMesh: AbstractMesh;
    if (item.emitter instanceof AbstractMesh) {
      emitterMesh = item.emitter;
    } else {
      emitterMesh = MeshBuilder.CreateBox(
        "bloodEmitterNode",
        { size: 0.5 },
        scene
      );
      emitterMesh.isVisible = false;
      emitterMesh.isPickable = false;
      item.emitter = emitterMesh;
    }

    emitterMesh.parent = mesh;
    const localPos = Vector3.TransformCoordinates(
      hitPoint.add(new Vector3(0, yOffset, 0)),
      mesh.getWorldMatrix().invert()
    );
    emitterMesh.position.copyFrom(localPos);

    item.ps.emitter = emitterMesh;

    // this._configureForIntensity(item.ps, intensity, colorOrTexture);

    item.releaseAt = Date.now() + this.options.defaultLifetimeMs * 0.5; // shorter duration
    item.ps.start();

    return item.ps;
  }

  private _createPoolItem(): PoolItem {
    const scene = this.scene;

    const emitter = MeshBuilder.CreateBox(
      "bloodEmitterNode",
      { size: 0.15 },
      scene
    );
    emitter.isVisible = false;
    emitter.isPickable = false;

    const ps = new ParticleSystem("bloodParticles", 20, scene); // higher capacity for goo
    ps.particleTexture = this._bloodTexture;

    // slime green colors
    ps.color1 = new Color4(0, 0.6, 0, 1);
    ps.color2 = new Color4(0.1, 0.8, 0.1, 1);
    ps.colorDead = new Color4(0, 0, 0, 0);

    ps.emitter = emitter;
    ps.minSize = 0.8;
    ps.maxSize = 1.19;

    ps.minEmitBox = new Vector3(-0.8, 0, -0.8);
    ps.maxEmitBox = new Vector3(0.8, 0, 0.8);

    ps.direction1 = new Vector3(-1.2, 1, -1.2);
    ps.direction2 = new Vector3(1.2, 1.5, 1.2);

    ps.gravity = new Vector3(0, -9.81, 0);
    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.0;
    ps.emitRate = 150;

    // เก็บไว้ reuse ใหม่
    ps.disposeOnStop = false;
    ps.stop();

    return { ps, emitter, inUse: false, releaseAt: 0 };
  }

  public spawnBloodFountainPool(
    mesh: AbstractMesh,
    hitPoint?: Vector3,
    intensity = 0.1
  ): Nullable<ParticleSystem> {
    const scene = mesh.getScene();
    if (!scene) return null;

    let item = this.pool.find((p) => !p.inUse);
    if (!item && this.options.allowAutoGrow) {
      item = this._createPoolItem();
      this.pool.push(item);
    }
    if (!item) return null;

    item.inUse = true;

    // Set emitter position
    const emitterPos = hitPoint
      ? hitPoint.clone()
      : mesh.getBoundingInfo().boundingBox.centerWorld.clone();
    emitterPos.y += 0.05; // optional small offset

    if (item.emitter instanceof AbstractMesh) {
      item.emitter.parent = mesh;
      //#region เพิ่มระยะจุดแสดงผลเลือด
      // const localPos = Vector3.TransformCoordinates(emitterPos, mesh.getWorldMatrix().invert());
      // item.emitter.position.copyFrom(localPos);
      //#endregion
    } else {
      item.emitter = emitterPos;
    }

    // Configure intensity dynamically
    // this._configureForIntensity(item.ps, intensity);

    // Mark release time for pooling
    const lifeMs = 200 * (1 + intensity); // adjust total lifetime if needed
    item.releaseAt = Date.now() + lifeMs;

    item.ps.start();

    return item.ps;
  }

  private _releasePoolItem(item: PoolItem) {
    try {
      item.ps.stop();
      item.inUse = false;
      item.releaseAt = 0;
      if (item.emitter instanceof AbstractMesh) item.emitter.parent = null;
    } catch {}
  }

  private _configureForIntensity(
    ps: ParticleSystem,
    intensity: number,
    colorOrTexture?: ColorOrTexture
  ) {
    intensity = Scalar.Clamp(intensity, 0.01, 2);

    ps.minSize = 0.92 * intensity;
    ps.maxSize = 0.52 * intensity;
    ps.emitRate = Math.max(15, Math.floor(25 * intensity));

    // Force particles upward + drop
    // ps.direction1 = new Vector3(0, 0.5 * intensity, 0);
    // ps.direction2 = new Vector3(0, 0.8 * intensity, 0);

    ps.minLifeTime = 0.1;
    ps.maxLifeTime = 0.25;

    ps.gravity = new Vector3(0, -9.81, 0);

    if (colorOrTexture?.particleTexture)
      ps.particleTexture = colorOrTexture.particleTexture;
    if (colorOrTexture?.color1) ps.color1 = colorOrTexture.color1;
    if (colorOrTexture?.color2) ps.color2 = colorOrTexture.color2;

    ps.colorDead = new Color4(0, 0, 0, 0);
  }
}
