const { withPodfile } = require("@expo/config-plugins");

// Google Sign-In pulls in the Swift pod AppCheckCore. CocoaPods integrates it as
// a static library, which fails unless these Objective-C deps emit module maps:
//   The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
//   `RecaptchaInterop`, which do not define modules.
const MODULAR_HEADER_PODS = ["GoogleUtilities", "RecaptchaInterop"];

function ensureModularHeaderPods(podfile) {
  const missing = MODULAR_HEADER_PODS.filter(
    (name) => !podfile.includes(`pod '${name}', :modular_headers => true`),
  );
  if (missing.length === 0) return podfile;

  const anchor = "use_expo_modules!";
  if (!podfile.includes(anchor)) {
    throw new Error(
      "withIosModularHeaders: expected use_expo_modules! in the generated Podfile",
    );
  }

  const lines = missing
    .map((name) => `  pod '${name}', :modular_headers => true`)
    .join("\n");

  return podfile.replace(anchor, `${anchor}\n${lines}`);
}

function withIosModularHeaders(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = ensureModularHeaderPods(config.modResults.contents);
    return config;
  });
}

module.exports = withIosModularHeaders;
module.exports.ensureModularHeaderPods = ensureModularHeaderPods;
