/* gl.js — tiny WebGL helper: context (WebGL2 preferred, WebGL1 fallback), shader compile,
   one full-screen triangle program, render-to-texture targets. No dependencies. */
(function (global) {
  "use strict";

  function create(canvas) {
    var opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" };
    var gl = null, version = 0;
    try { gl = canvas.getContext("webgl2", opts); if (gl) version = 2; } catch (e) {}
    if (!gl) { try { gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts); if (gl) version = 1; } catch (e) {} }
    if (!gl) return null;
    var renderer = "?", vendor = "?";
    try {
      var dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) { renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL); vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL); }
      else { renderer = gl.getParameter(gl.RENDERER); vendor = gl.getParameter(gl.VENDOR); }
    } catch (e) {}
    return { gl: gl, version: version, renderer: renderer, vendor: vendor, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error("shader: " + log); }
    return s;
  }

  /* A program drawing one full-screen triangle; the fragment shader gets v_uv in [0,1] (y up). */
  function fullscreenProgram(gl, frag) {
    var vert = "attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }";
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, "a_pos");
    var uniforms = {};
    return {
      program: p,
      use: function () { gl.useProgram(p); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); },
      u: function (name) { if (!(name in uniforms)) uniforms[name] = gl.getUniformLocation(p, name); return uniforms[name]; },
      set1f: function (n, v) { var l = this.u(n); if (l) gl.uniform1f(l, v); },
      set2f: function (n, a, b) { var l = this.u(n); if (l) gl.uniform2f(l, a, b); },
      set4f: function (n, a, b, c, d) { var l = this.u(n); if (l) gl.uniform4f(l, a, b, c, d); },
      set1i: function (n, v) { var l = this.u(n); if (l) gl.uniform1i(l, v); },
      draw: function () { gl.drawArrays(gl.TRIANGLES, 0, 3); }
    };
  }

  /* Render target: RGB texture + framebuffer, linear filtering, clamped. */
  function renderTarget(gl, w, h) {
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null);
    return { tex: tex, fb: fb, w: w, h: h, ok: ok,
      dispose: function () { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); } };
  }

  global.GLH = { create: create, fullscreenProgram: fullscreenProgram, renderTarget: renderTarget };
})(window);
