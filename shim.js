// shim.js
try {
  const encoding = require("text-encoding");

  // 1. Delete the built-in (broken) decoder
  if (global.TextDecoder) {
    delete global.TextDecoder;
  }
  if (global.TextEncoder) {
    delete global.TextEncoder;
  }

  // 2. Apply the polyfill
  global.TextEncoder = encoding.TextEncoder;
  global.TextDecoder = encoding.TextDecoder;

  console.log("✅ Polyfill applied successfully!");
} catch (error) {
  console.error("❌ Polyfill FAILED to load:", error);
  // The app will continue running, but maps might crash later if this failed.
}
