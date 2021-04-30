
var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const requestAlerts = new Map();
const grantedAlerts = new Map();
let quitConfirmed;

const QuitObservers = {
  requested: {
    observe(subject, topic, data) {
      if (requestAlerts.size > 0) {
        const aWindow = Services.wm.getMostRecentWindow(null);

        quitConfirmed = new Set();
        aWindow.setTimeout(() => {
          // In case the quit request is canceled by some other listener, we
          // want to ensure that the user still gets prompted *next* time they
          // exit, so we'll clear quitConfirmed.
          console.log("clearing quitConfirmed");
          quitConfirmed = undefined;
        }, 0);

        for (let ext of requestAlerts.keys()) {
          quitConfirmed.add(ext);
          let alert = requestAlerts.get(ext);
          let result = Services.prompt.confirm(aWindow, alert.title, alert.message);
          if (!result) {
            subject.QueryInterface(Ci.nsISupportsPRBool);
            subject.data = true;
            break;
          }
        }
      }
    }
  },

  granted:{
    observe() {
      if (grantedAlerts.size > 0) {
        const aWindow = Services.wm.getMostRecentWindow(null);
        for (let ext of grantedAlerts.keys()) {
          let alert = grantedAlerts.get(ext);
          if (quitConfirmed && quitConfirmed.has(ext)) {
            // Don't allow an extension to create more than one notification.
            continue;
          } else {
            Services.prompt.alert(aWindow, alert.title, alert.message);
          }
        }
      }
    }
  }
};

var quitter = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    let { extension } = context;

    context.callOnClose(this);

    // Setup application quit observer
    Services.obs.addObserver(QuitObservers.requested, "quit-application-requested");
    Services.obs.addObserver(QuitObservers.granted, "quit-application-granted");

    return {
      quitter: {
        async setQuitRequestedAlert(title, message) {
          requestAlerts.set(extension.id, { title, message });
        },
        async setQuitGrantedAlert(title, message) {
          grantedAlerts.set(extension.id, { title, message });
        },
        async removeQuitRequestedObserver() {
          if (requestAlerts.has(extension.id))
            requestAlerts.delete(extension.id);
        },
        async removeQuitGrantedObserver() {
          if (grantedAlerts.has(extension.id))
            grantedAlerts.delete(extension.id);
        }
      }
    }
  }

  close() {
    console.debug("Removing ouit observers");
    Services.obs.removeObserver(QuitObservers.requested, "quit-application-requested");
    Services.obs.removeObserver(QuitObservers.granted, "quit-application-granted");
  }
}