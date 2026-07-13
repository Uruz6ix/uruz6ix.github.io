(() => {
  "use strict";

  const { createApp } = Vue;


  const appElement = document.getElementById("rain-app");

  if (!appElement) {
    console.error("Rain app element was not found.");
    return;
  }

  const rootPath = appElement.dataset.root.endsWith("/")
    ? appElement.dataset.root
    : `${appElement.dataset.root}/`;

  const useMobileAssets = window.matchMedia("(max-width: 700px)").matches;

  const assetUrl = filename =>
    `${rootPath}${useMobileAssets ? "mobile/" : ""}${filename}`;

  const CONFIG = {
    staticLayers: [
      assetUrl("static1.png"),
      assetUrl("static2.png"),
    ],

    dropImages: [
      assetUrl("drop1.png"),
      assetUrl("drop2.png"),
      assetUrl("drop3.png"),
      assetUrl("drop4.png"),
    ],

    dropGrid: {
      rows: 9,
      columns: 11,
      minX: 0.1,
      maxX: 0.90,
      minY: 0.1,
      maxY: 0.90,
      jitterX: 0.02,
      jitterY: 0.04,
    },

    dropEffect: {
      radius: 0.40,
      baseOpacity: 0.48,
      activeOpacity: 1.0,
      baseSaturation: 0.65,
      activeSaturation: 1.65,
      baseBrightness: 0.92,
      activeBrightness: 1.10,
      activeScale: 1.08,
    },

    leaves: [
      { src: assetUrl("leaf1.png"),  anchorX: 0.75, anchorY: 0.68, originX: 75,  originY: 68, direction: 1 },
      { src: assetUrl("leaf2.png"),  anchorX: 0.58, anchorY: 0.89, originX: 58, originY: 89, direction: -1 },
      { src: assetUrl("leaf3.png"),  anchorX: 0.85, anchorY: 0.36, originX: 85, originY: 36, direction: 1 },
      { src: assetUrl("leaf4.png"),  anchorX: 0.84, anchorY: 0.44, originX: 84, originY: 44, direction: -1 },
      { src: assetUrl("leaf5.png"),  anchorX: 0.58, anchorY: 0.50, originX: 58, originY: 50, direction: 1 },
      { src: assetUrl("leaf6.png"),  anchorX: 0.65, anchorY: 0.70, originX: 65, originY: 70, direction: -1 },
      { src: assetUrl("leaf7.png"),  anchorX: 0.43, anchorY: 0.74, originX: 43, originY: 74, direction: -1 },
      { src: assetUrl("leaf8.png"),  anchorX: 0.51, anchorY: 0.65, originX: 51, originY: 65, direction: 1 },
      { src: assetUrl("leaf9.png"),  anchorX: 0.44, anchorY: 0.55, originX: 44, originY: 55, direction: 1 },
      { src: assetUrl("leaf10.png"), anchorX: 0.34, anchorY: 0.57, originX: 34, originY: 57, direction: -1 },
      { src: assetUrl("leaf11.png"), anchorX: 0.32, anchorY: 0.575, originX: 32, originY: 57, direction: 1 },
      { src: assetUrl("leaf12.png"), anchorX: 0.34, anchorY: 0.70, originX: 34, originY: 70, direction: -1 },
      { src: assetUrl("leaf13.png"), anchorX: 0.15, anchorY: 0.53, originX: 15, originY: 53, direction: 1 },
    ].map((leaf, index) => ({
      ...leaf,
      id: `leaf-${index + 1}`,
      radius: 0.47,
      maxRotation: 9.5,
      maxShift: 0,
    })),
  };
  createApp({
    data() {
  return {
    staticLayers: CONFIG.staticLayers,
    leaves: CONFIG.leaves,
    drops: [],

    pointer: {
      x: 0.5,
      y: 0.5,
      active: false,
    },

    pendingPointer: null,
    animationFrameId: null,
    activePointerId: null,
  };
},
    mounted() {
        this.drops = this.createDropGrid();
    },

    beforeUnmount() {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
      }
    },

    methods: {
      
      clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
      },
      portraitRevealStyle() {
        const edgeDistance = Math.min(
          this.pointer.x,
          1 - this.pointer.x,
          this.pointer.y,
          1 - this.pointer.y
        );

        const opacity = this.pointer.active
          ? 0.92 * this.smoothStep(edgeDistance / 0.08)
          : 0;

        return {
          opacity,
          "--reveal-x": `${this.pointer.x * 100}%`,
          "--reveal-y": `${this.pointer.y * 100}%`,
        };
      },
      smoothStep(value) {
        const x = this.clamp(value, 0, 1);
        return x * x * (3 - 2 * x);
      },

      seededValue(seed) {
        const value =
          Math.sin(seed * 12.9898 + 78.233) * 43758.5453;

        return value - Math.floor(value);
      },

      createDropGrid() {
  const grid = CONFIG.dropGrid;
  const drops = [];

  for (let row = 0; row < grid.rows; row += 1) {
    for (
      let column = 0;
      column < grid.columns;
      column += 1
    ) {
      const index = row * grid.columns + column;

      const columnRatio =
        grid.columns === 1
          ? 0.5
          : column / (grid.columns - 1);

      const rowRatio =
        grid.rows === 1
          ? 0.5
          : row / (grid.rows - 1);

      const baseX =
        grid.minX +
        columnRatio * (grid.maxX - grid.minX);

      const baseY =
        grid.minY +
        rowRatio * (grid.maxY - grid.minY);

      /*
       * 使用 Math.random()：
       * 每次刷新都会重新生成位置、种类、大小和角度。
       */
      const jitterX =
        (Math.random() - 0.5) * grid.jitterX;

      const jitterY =
        (Math.random() - 0.5) * grid.jitterY;

      drops.push({
        id: `drop-${index}`,

        src: CONFIG.dropImages[
          Math.floor(
            Math.random() * CONFIG.dropImages.length
          )
        ],

        x: this.clamp(baseX + jitterX, 0, 1),
        y: this.clamp(baseY + jitterY, 0, 1),

        rotation: -10 + Math.random() * 20,
        baseScale: 0.78 + Math.random() * 0.44,
      });
    }
  }

  return drops;
},

      updatePointer(event) {
        const rect =
          this.$refs.scene.getBoundingClientRect();

        if (!rect.width || !rect.height) {
          return;
        }

        this.pendingPointer = {
          x: this.clamp(
            (event.clientX - rect.left) / rect.width,
            0,
            1
          ),
          y: this.clamp(
            (event.clientY - rect.top) / rect.height,
            0,
            1
          ),
        };

        if (this.animationFrameId !== null) {
          return;
        }

        this.animationFrameId =
          requestAnimationFrame(() => {
            if (this.pendingPointer) {
              this.pointer.x = this.pendingPointer.x;
              this.pointer.y = this.pendingPointer.y;
              this.pointer.active = true;
            }

            this.animationFrameId = null;
          });
      },

      onPointerDown(event) {
        this.activePointerId = event.pointerId;
        this.$refs.scene.setPointerCapture?.(event.pointerId);
        this.updatePointer(event);
      },

      onPointerMove(event) {
        if (event.pointerType !== "mouse" &&
            this.activePointerId !== event.pointerId) {
          return;
        }

        this.updatePointer(event);
      },

      onPointerLeave(event) {
        if (event.pointerType !== "mouse") {
          return;
        }

        this.pointer.active = false;
      },

      onPointerEnd(event) {
        if (this.activePointerId !== event.pointerId) {
          return;
        }

        if (this.$refs.scene.hasPointerCapture?.(event.pointerId)) {
          this.$refs.scene.releasePointerCapture(event.pointerId);
        }
        this.activePointerId = null;
        this.pointer.active = false;
      },

      distanceInfluence(x, y, radius) {
        if (!this.pointer.active) {
          return 0;
        }

        /*
         * 按画面归一化坐标计算距离。
         * 这样画布响应式缩放后，作用范围保持一致。
         */
        const dx = x - this.pointer.x;
        const dy = y - this.pointer.y;
        const distance = Math.hypot(dx, dy);

        return this.smoothStep(
          1 - distance / radius
        );
      },

      dropStyle(drop) {
        const effect = CONFIG.dropEffect;

        const influence = this.distanceInfluence(
          drop.x,
          drop.y,
          effect.radius
        );

        const opacity =
          effect.baseOpacity +
          influence *
            (effect.activeOpacity -
              effect.baseOpacity);

        const saturation =
          effect.baseSaturation +
          influence *
            (effect.activeSaturation -
              effect.baseSaturation);

        const brightness =
          effect.baseBrightness +
          influence *
            (effect.activeBrightness -
              effect.baseBrightness);

        const scale =
          drop.baseScale *
          (1 +
            influence *
              (effect.activeScale - 1));

        return {
          left: `${drop.x * 100}%`,
          top: `${drop.y * 100}%`,
          opacity,
          filter:
            `saturate(${saturation}) ` +
            `brightness(${brightness})`,
          transform:
            "translate(-50%, -50%) " +
            `rotate(${drop.rotation}deg) ` +
            `scale(${scale})`,
        };
      },

      leafStyle(leaf) {
  const influence = this.distanceInfluence(
    leaf.anchorX,
    leaf.anchorY,
    leaf.radius
  );

  // 指针相对植物中心的水平位置，范围限制在 -1 到 1。
  const horizontalOffset = this.clamp(
    (this.pointer.x - leaf.anchorX) / leaf.radius,
    -1,
    1
  );

  const rotation =
    influence *
    leaf.maxRotation *
    horizontalOffset *
    leaf.direction;

  const shiftX =
    influence *
    leaf.maxShift *
    horizontalOffset;

  return {
    transformOrigin:
      `${leaf.originX}% ${leaf.originY}%`,

    transform:
      `translateX(${shiftX}px) ` +
      `rotate(${rotation}deg)`,
  };
},
    },
  }).mount(appElement);
})();