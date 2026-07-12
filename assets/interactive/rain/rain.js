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

  const assetUrl = filename => `${rootPath}${filename}`;

  const CONFIG = {
    staticLayers: [
      assetUrl("static1.png"),
      assetUrl("static2.png"),
    ],

    dropImages: [
      assetUrl("drop1.png"),
      assetUrl("drop2.png"),
      assetUrl("drop3.png"),
    ],

    dropGrid: {
      rows: 8,
      columns: 11,
      minX: 0.05,
      maxX: 0.95,
      minY: 0.05,
      maxY: 0.95,
      jitterX: 0.012,
      jitterY: 0.014,
    },

    dropEffect: {
      radius: 0.40,
      baseOpacity: 0.28,
      activeOpacity: 1.0,
      baseSaturation: 0.65,
      activeSaturation: 1.65,
      baseBrightness: 0.92,
      activeBrightness: 1.10,
      activeScale: 1.08,
    },

    leaves: [
      { src: assetUrl("leaf1.png"),  anchorX: 0.08, anchorY: 0.84, originX: 8,  originY: 84, direction: 1 },
      { src: assetUrl("leaf2.png"),  anchorX: 0.15, anchorY: 0.78, originX: 15, originY: 78, direction: -1 },
      { src: assetUrl("leaf3.png"),  anchorX: 0.22, anchorY: 0.86, originX: 22, originY: 86, direction: 1 },
      { src: assetUrl("leaf4.png"),  anchorX: 0.30, anchorY: 0.80, originX: 30, originY: 80, direction: -1 },
      { src: assetUrl("leaf5.png"),  anchorX: 0.38, anchorY: 0.87, originX: 38, originY: 87, direction: 1 },
      { src: assetUrl("leaf6.png"),  anchorX: 0.45, anchorY: 0.81, originX: 45, originY: 81, direction: -1 },
      { src: assetUrl("leaf7.png"),  anchorX: 0.52, anchorY: 0.86, originX: 52, originY: 86, direction: 1 },
      { src: assetUrl("leaf8.png"),  anchorX: 0.59, anchorY: 0.79, originX: 59, originY: 79, direction: -1 },
      { src: assetUrl("leaf9.png"),  anchorX: 0.66, anchorY: 0.85, originX: 66, originY: 85, direction: 1 },
      { src: assetUrl("leaf10.png"), anchorX: 0.73, anchorY: 0.80, originX: 73, originY: 80, direction: -1 },
      { src: assetUrl("leaf11.png"), anchorX: 0.80, anchorY: 0.87, originX: 80, originY: 87, direction: 1 },
      { src: assetUrl("leaf12.png"), anchorX: 0.88, anchorY: 0.81, originX: 88, originY: 81, direction: -1 },
      { src: assetUrl("leaf13.png"), anchorX: 0.95, anchorY: 0.86, originX: 95, originY: 86, direction: 1 },
    ].map((leaf, index) => ({
      ...leaf,
      id: `leaf-${index + 1}`,
      radius: 0.27,
      maxRotation: 4.5,
      maxShift: 5,
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
        coarsePointer: false,
        };
    },
    mounted() {
        this.coarsePointer = window.matchMedia(
            "(hover: none), (pointer: coarse)"
        ).matches;

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

            const jitterX =
              (this.seededValue(index * 2 + 1) - 0.5) *
              grid.jitterX;

            const jitterY =
              (this.seededValue(index * 2 + 2) - 0.5) *
              grid.jitterY;

            drops.push({
              id: `drop-${index}`,
              src: CONFIG.dropImages[
                index % CONFIG.dropImages.length
                ],
              x: this.clamp(baseX + jitterX, 0, 1),
              y: this.clamp(baseY + jitterY, 0, 1),
              rotation:
                -10 +
                this.seededValue(index * 3 + 5) * 20,
              baseScale:
                0.86 +
                this.seededValue(index * 5 + 9) * 0.22,
            });
          }
        }

        return drops;
      },

      onPointerMove(event) {
        if (this.coarsePointer) {
          return;
        }

        const rect =
          this.$refs.scene.getBoundingClientRect();

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

      onPointerLeave() {
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

        /*
         * 指针位于植物左侧或右侧时，摆动方向不同。
         */
        const horizontalDirection =
          this.pointer.x < leaf.anchorX ? -1 : 1;

        const rotation =
          influence *
          leaf.maxRotation *
          horizontalDirection *
          leaf.direction;

        const shiftX =
          influence *
          leaf.maxShift *
          horizontalDirection;

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