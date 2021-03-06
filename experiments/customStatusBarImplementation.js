var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { ExtensionSupport } = ChromeUtils.import(
  "resource:///modules/ExtensionSupport.jsm"
);
var { ExtensionCommon } = ChromeUtils.import(
  "resource://gre/modules/ExtensionCommon.jsm"
);
var { ExtensionUtils } = ChromeUtils.import(
  "resource://gre/modules/ExtensionUtils.jsm"
);
var { ExtensionError } = ExtensionUtils;
var { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm"
);

var StatusMenuItemCallbacks = {
  listeners: new Set(),

  add(listener) {
    this.listeners.add(listener);
  },

  remove(listener) {
    this.listeners.delete(listener);
  },

  emit(msg) {
    for (let listener of this.listeners) {
      listener(msg);
    }
  }
}

class StatusMenu {
  constructor(id, statusText, visible) {
    this.id = id;
    this.buttonId = ExtensionCommon.makeWidgetId(this.id + '-button');
    this.menuId = ExtensionCommon.makeWidgetId(this.id + '-menu');
    this.statusText = statusText;
    this.visible = visible;
    this.menuItems = new Set();
  }

  destroy() {
    if (this.destroyed) throw new Error("Unable to destroy StatusMenu twice");

    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      try {
        window.document.getElementById(this.menuId).remove();
        window.document.getElementById(this.buttonId).remove();
      } catch (ex) {
        console.error(ex);
      }
    }
  }

  static waitForWindow(window) {
    return new Promise((resolve) => {
      if (window.document.readyState == "complete") resolve();
      else window.addEventListener("load", resolve, { once: true });
    });
  }

  async setStatusMessage(text) {
    this.statusText = text;
    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      await StatusMenu.waitForWindow(window);
      let toolbarbutton = window.document.getElementById(this.buttonId);
      if (toolbarbutton) toolbarbutton.setAttribute("label", text);
    }
  }

  async addToCurrentWindows() {
    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      await StatusMenu.waitForWindow(window);
      this.addToWindow(window);
    }
  }

  async setVisible(visible) {
    this.visible = visible;
    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      await StatusMenu.waitForWindow(window);
      let toolbarbutton = window.document.getElementById(this.buttonId);
      if (toolbarbutton) toolbarbutton.setAttribute("hidden", !visible);
    }
  }

  addItem(properties) {
    this.menuItems.add({
      id: `${properties.id}`,
      label: properties.label
    });
  }

  addToWindow(window) {
    let toolbarbutton = window.document.createXULElement("toolbarbutton");
    let buttonAttributes = {
      id: this.buttonId,
      hidden: !this.visible,
      label: this.statusText,
      oncommand: `window.document.getElementById('${this.menuId}').openPopup(this, 'after_start')`,
    };
    for (let [key, value] of Object.entries(buttonAttributes)) {
      toolbarbutton.setAttribute(key, value);
    }
    let popup = window.document.createXULElement("menupopup");
    popup.setAttribute("id", this.menuId);

    for (let item of this.menuItems) {
      let e = window.document.createXULElement("menuitem");
      for (let [key, value] of Object.entries(item)) {
        e.setAttribute(key, value);
      }
      popup.appendChild(e);
    }

    let parent = window.document.getElementById("status-bar");
    parent.insertBefore(popup, parent.firstChild.nextSibling);
    parent.insertBefore(toolbarbutton, popup);

    for (let item of this.menuItems) {
      let e = window.document.getElementById(item.id);
      if (e) {
        e.addEventListener("command", evt => {
          let id = evt.target.getAttribute("id");
          StatusMenuItemCallbacks.emit(id);
        });
      }
    }
  }
}

var statusBar = class extends ExtensionCommon.ExtensionAPI {
  close() {
    for (let menu of this.customMenus.values()) {
      try {
        menu.destroy();
      } catch (ex) {
        console.error("Unable to destroy menu:", ex);
      }
    }
    ExtensionSupport.unregisterWindowListener("customStatusMenuWL");
  }

  getAPI(context) {
    context.callOnClose(this);

    // Note: This was originally written to handle multiple
    // menus, but was later changed to hard code the 'menuId'
    // variable below, which limits it to a single menu.
    // Much of the previous implementation is still present, however,
    // including this customMenus map object.
    let customMenus = new Map();
    this.customMenus = customMenus;

    const menuId = `${context.extension.id}-status-menu`;

    ExtensionSupport.registerWindowListener("customStatusMenuWL", {
      chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
      async onLoadWindow(window) {
        await StatusMenu.waitForWindow(window);
        for (let menu of customMenus.values()) menu.addToWindow(window);
      },
    });

    return {
      statusBar: {

        async addStatusMenu(label, visible, menuItems) {
          if (customMenus.has(menuId))
            throw new ExtensionError("You can only add one menu to the status bar.");
          let menu = new StatusMenu(menuId, label, visible);
          for (let item of menuItems)
            menu.addItem(item);
          await menu.addToCurrentWindows();
          customMenus.set(menuId, menu);
        },

        async removeStatusMenu() {
          let menu = customMenus.get(menuId);
          if (!menu)
            throw new ExtensionError("Cannot remove non-existent menu");
          menu.destroy();
          customMenus.delete(menuId);
        },

        async setStatusMessage(text) {
          let menu = customMenus.get(menuId);
          if (!menu)
            throw new ExtensionError("Cannot set status of non-existent menu");
          menu.setStatusMessage(text);
        },

        async setVisible(visible) {
          let menu = customMenus.get(menuId);
          if (!menu)
            throw new ExtensionError("Cannot set visibility of non-existent menu");
          menu.setVisible(visible);
        },

        statusMenuCallback: new ExtensionCommon.EventManager({
          context,
          name: "statusBar.statusMenuCallback",
          inputHandling: true,
          register: fire => {
            const callback = (evt => fire.async(evt));
            StatusMenuItemCallbacks.add(callback);
            return function() {
              StatusMenuItemCallbacks.remove(callback);
            };
          }
        }).api()

      },
    };
  }
};
