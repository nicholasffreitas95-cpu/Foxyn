// ============================================================
// FOXYN - Benchmark WebGL (medição REAL de FPS no navegador)
// Renderiza uma cena 3D via WebGL e mede quadros por segundo.
// Sem bibliotecas externas. Sem números fabricados.
// ============================================================
const FoxynBenchmark = (() => {
  const VERT_SRC = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    uniform mat4 uMVP;
    uniform mat4 uModel;
    uniform vec3 uLightDir;
    varying vec3 vNormal;
    varying vec3 vPos;
    void main() {
      vec4 world = uModel * vec4(aPos, 1.0);
      vPos = world.xyz;
      vNormal = mat3(uModel) * aNormal;
      gl_Position = uMVP * vec4(aPos, 1.0);
    }
  `;

  const FRAG_SRC = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vPos;
    uniform vec3 uColor;
    uniform vec3 uLightDir;
    void main() {
      vec3 n = normalize(vNormal);
      float diff = max(dot(n, normalize(uLightDir)), 0.0);
      vec3 base = uColor * (0.35 + 0.65 * diff);
      gl_FragColor = vec4(base, 1.0);
    }
  `;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error("Erro de shader: " + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  // Gera um cubo colorido por face com normais (vextex + index)
  function makeCube(gl) {
    // 24 vertices: cada face tem seus proprios normais (arte posterior)
    const P = [
      [-1,-1,-1],[ 1,-1,-1],[ 1, 1,-1],[-1, 1,-1], // frente (z=-1)
      [-1,-1, 1],[ 1,-1, 1],[ 1, 1, 1],[-1, 1, 1], // tras (z=+1)
      [-1,-1,-1],[-1, 1,-1],[-1, 1, 1],[-1,-1, 1], // esquerda (x=-1)
      [ 1,-1,-1],[ 1, 1,-1],[ 1, 1, 1],[ 1,-1, 1], // direita (x=+1)
      [-1,-1,-1],[-1,-1, 1],[ 1,-1, 1],[ 1,-1,-1], // baixo (y=-1)
      [-1, 1,-1],[-1, 1, 1],[ 1, 1, 1],[ 1, 1,-1]  // cima (y=+1)
    ];
    const N = [
      [0,0,-1],[0,0,-1],[0,0,-1],[0,0,-1],
      [0,0, 1],[0,0, 1],[0,0, 1],[0,0, 1],
      [-1,0,0],[-1,0,0],[-1,0,0],[-1,0,0],
      [ 1,0,0],[ 1,0,0],[ 1,0,0],[ 1,0,0],
      [0,-1,0],[0,-1,0],[0,-1,0],[0,-1,0],
      [0, 1,0],[0, 1,0],[0, 1,0],[0, 1,0]
    ];
    const F = [
      [0,1,2,0,2,3],[4,5,6,4,6,7],[8,9,10,8,10,11],
      [12,13,14,12,14,15],[16,17,18,16,18,19],[20,21,22,20,22,23]
    ];
    return { P, N, F };
  }

  function buildProgram(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Erro de link: " + gl.getProgramInfoLog(prog));
    }
    prog.loc = {
      aPos: gl.getAttribLocation(prog, "aPos"),
      aNormal: gl.getAttribLocation(prog, "aNormal"),
      uMVP: gl.getUniformLocation(prog, "uMVP"),
      uModel: gl.getUniformLocation(prog, "uModel"),
      uColor: gl.getUniformLocation(prog, "uColor"),
      uLightDir: gl.getUniformLocation(prog, "uLightDir")
    };
    return prog;
  }

  function buildBuffers(gl, cube) {
    const pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube.P.flat()), gl.STATIC_DRAW);

    const nor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nor);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube.N.flat()), gl.STATIC_DRAW);

    const idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cube.F.flat()), gl.STATIC_DRAW);

    return { pos, nor, idx, count: cube.F.flat().length };
  }

  // ---------- Utilidades de matriz (mat4) ----------
  function identity() {
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ];
  }
  function lookAt(eye, target, up) {
    const z = norm(sub(eye, target));
    const x = norm(cross(up, z));
    const y = cross(z, x);
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ];
  }
  function multiply(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }
  function rotationY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
  }
  function translation(t) {
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, t[0],t[1],t[2],1];
  }
  function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; }
  function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }

  const COLORS = [
    [0.95,0.35,0.35],[0.90,0.70,0.25],[0.35,0.90,0.45],
    [0.35,0.60,0.95],[0.75,0.40,0.95],[0.30,0.85,0.85]
  ];

  const DEFAULT_DURATION_SEC = 8;
  const DEFAULT_CUBES = 150;

  function paleta(i) {
    return COLORS[i % COLORS.length];
  }

  // Constrói a cena (lista de cubos com transformações)
  function buildScene(count) {
    const side = Math.ceil(Math.cbrt(count));
    const span = 5;
    const step = span / Math.max(side, 1);
    const cubes = [];
    for (let i = 0; i < count; i++) {
      const ix = i % side;
      const iy = Math.floor(i / side) % side;
      const iz = Math.floor(i / (side * side));
      const x = (ix - side / 2) * step;
      const y = (iy - side / 2) * step;
      const z = (iz - side / 2) * step;
      cubes.push({
        pos: [x, y, z],
        color: paleta(i),
        rotSpeed: 0.5 + ((i * 13) % 100) / 200,
        scale: 1 + ((i * 7) % 40) / 100
      });
    }
    return cubes;
  }

  /**
   * Roda o benchmark real.
   * @param {Object} opts { durationSec?, cubes?, onProgress?(pct, fps), onComplete?(stats) }
   * @returns Promise<stats>
   */
  function run(opts = {}) {
    return new Promise((resolve, reject) => {
      const durationSec = opts.durationSec || DEFAULT_DURATION_SEC;
      const cubes = buildScene(opts.cubes || DEFAULT_CUBES);

      const canvas =
        opts.canvas ||
        (() => {
          const c = document.createElement("canvas");
          c.width = 640;
          c.height = 480;
          return c;
        })();
      if (!canvas.width) canvas.width = 640;
      if (!canvas.height) canvas.height = 480;
      const gl =
        canvas.getContext("webgl", { antialias: true }) ||
        canvas.getContext("experimental-webgl", { antialias: true });

      if (!gl) {
        reject(new Error("WebGL não está disponível neste navegador/dispositivo."));
        return;
      }

      let program, buffers;
      try {
        program = buildProgram(gl);
        const cube = makeCube(gl);
        buffers = buildBuffers(gl, cube);
      } catch (e) {
        reject(e);
        return;
      }

      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.04, 0.05, 0.09, 1);

      const aspect = canvas.width / canvas.height;
      const proj = perspective((60 * Math.PI) / 180, aspect, 0.1, 100);
      const view = lookAt([0, 1.5, 9], [0, 0, 0], [0, 1, 0]);

      const click = { angle: 0 };
      const uniforms = {
        aPos: program.loc.aPos,
        aNormal: program.loc.aNormal,
        uMVP: program.loc.uMVP,
        uModel: program.loc.uModel,
        uColor: program.loc.uColor,
        uLightDir: gl.getUniformLocation(program, "uLightDir")
      };

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos);
      gl.enableVertexAttribArray(uniforms.aPos);
      gl.vertexAttribPointer(uniforms.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.nor);
      gl.enableVertexAttribArray(uniforms.aNormal);
      gl.vertexAttribPointer(uniforms.aNormal, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.idx);

      gl.useProgram(program);
      gl.uniform3fv(uniforms.uLightDir, [0.5, 0.8, 0.6]);

      // ---------- Medição ----------
      const start = performance.now();
      const endTime = start + durationSec * 1000;
      const samples = []; // fps médio por segundo
      let frames = 0;
      let lastSecondStart = start;
      let lastFrameTime = null;
      let lastSecondFps = 0;

      function drawCubes(gl, program, buffers, cubeList, proj, view, click) {
        for (let i = 0; i < cubeList.length; i++) {
          const cb = cubeList[i];
          const rot = rotationY(click.angle * cb.rotSpeed);
          const t = translation(cb.pos);
          const s = cb.scale;
          const model = multiply(multiply(t, rot), [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1]);
          const mvp = multiply(multiply(proj, view), model);

          gl.uniformMatrix4fv(uniforms.uMVP, false, mvp);
          gl.uniformMatrix4fv(uniforms.uModel, false, model);
          gl.uniform3fv(uniforms.uColor, cb.color);
          gl.drawElements(gl.TRIANGLES, buffers.count, gl.UNSIGNED_SHORT, 0);
        }
      }

      function render(now) {
        const dtMs = lastFrameTime === null ? 0 : now - lastFrameTime;
        lastFrameTime = now;
        if (dtMs > 0) frames++;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        click.angle += 0.01;
        drawCubes(gl, program, buffers, cubes, proj, view, click);

        if (now - lastSecondStart >= 1000) {
          const secFps = (frames * 1000) / (now - lastSecondStart);
          samples.push(secFps);
          lastSecondFps = secFps;
          frames = 0;
          lastSecondStart = now;
          const pct = Math.min(100, ((now - start) / (endTime - start)) * 100);
          if (opts.onProgress) opts.onProgress(Math.round(pct), Math.round(secFps));
        }

        if (now >= endTime) {
          const avgFps = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
          const fpsMin = samples.length ? Math.min(...samples) : 0;
          const fpsMax = samples.length ? Math.max(...samples) : 0;
          const score = Math.max(0, Math.min(100, Math.round(((avgFps - 10) / (150 - 10)) * 100)));

          const stats = {
            fpsAvg: Math.round(avgFps * 10) / 10,
            fpsMin: Math.round(fpsMin),
            fpsMax: Math.round(fpsMax),
            score,
            durationSec,
            resolution: canvas.width + "x" + canvas.height
          };
          resolve(stats);
          return;
        }

        requestAnimationFrame(render);
      }

      if (opts.onProgress) opts.onProgress(0, 0);
      requestAnimationFrame(render);
    });
  }

  // Verifica disponibilidade de WebGL rapidamente
  function isSupported() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  }

  return { run, isSupported, DEFAULT_DURATION_SEC, DEFAULT_CUBES };
})();
