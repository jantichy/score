"use strict";
// Miniaturní DOM pro testy UI komponent v Node (tests/ui.test.js) — implementuje
// jen podmnožinu API, kterou kód v js/ui/ skutečně používá (el(), classList,
// focus, hidden, querySelectorAll s jednoduchými selektory). Není to obecný DOM;
// když UI kód začne používat další API, doplní se sem.

class StubElement {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.handlers = {};
    this._classes = new Set();
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
  }

  get className() { return [...this._classes].join(" "); }
  set className(v) {
    this._classes = new Set(String(v).split(/\s+/).filter(Boolean));
  }

  get classList() {
    const self = this;
    return {
      add: (...cs) => cs.forEach((c) => self._classes.add(c)),
      remove: (...cs) => cs.forEach((c) => self._classes.delete(c)),
      contains: (c) => self._classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !self._classes.has(c) : !!force;
        if (on) self._classes.add(c); else self._classes.delete(c);
        return on;
      },
    };
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === "class") this.className = v;
    else if (k === "disabled" || k === "checked" || k === "selected") this[k] = true;
    else if (k === "value") this.value = String(v);
  }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }

  append(...nodes) { for (const n of nodes) this.appendChild(n); }
  appendChild(n) {
    n.parentNode = this;
    this.children.push(n);
    return n;
  }
  removeChild(n) {
    const i = this.children.indexOf(n);
    if (i >= 0) this.children.splice(i, 1);
    n.parentNode = null;
    return n;
  }
  get firstChild() { return this.children[0] || null; }

  get textContent() {
    return this.children
      .map((c) => (c.nodeType === 3 ? c.text : c.textContent))
      .join("");
  }
  set textContent(v) {
    this.children = v === "" ? [] : [{ nodeType: 3, text: String(v) }];
  }

  addEventListener(type, fn) {
    (this.handlers[type] = this.handlers[type] || []).push(fn);
  }
  dispatch(type, ev) {
    const event = Object.assign(
      { type, target: this, preventDefault() {}, stopPropagation() {} },
      ev);
    for (const fn of this.handlers[type] || []) fn(event);
    return event;
  }
  click() { this.dispatch("click"); }

  focus() { stubDocument.activeElement = this; }
  blur() { if (stubDocument.activeElement === this) stubDocument.activeElement = null; }

  // Selektory: čárkou oddělený seznam jednoduchých selektorů "tag", ".class",
  // "tag.class" (i s více třídami). Kombinátory (mezera, >) nejsou podporované.
  matches(selector) {
    return String(selector).split(",").some((s) => {
      s = s.trim();
      if (!s) return false;
      const parts = s.split(".");
      const tag = parts[0];
      if (tag && tag !== "*" && this.tagName !== tag.toUpperCase()) return false;
      return parts.slice(1).every((c) => this._classes.has(c));
    });
  }
  closest(selector) {
    let n = this;
    while (n && n.nodeType === 1) {
      if (n.matches(selector)) return n;
      n = n.parentNode;
    }
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const c of node.children) {
        if (c.nodeType !== 1) continue;
        if (c.matches(selector)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

const stubDocument = {
  activeElement: null,
  createElement: (tag) => new StubElement(tag),
  createTextNode: (text) => ({ nodeType: 3, text: String(text) }),
  getElementById: () => null,
  elementFromPoint: () => null,
};

globalThis.document = stubDocument;
module.exports = { StubElement, document: stubDocument };
