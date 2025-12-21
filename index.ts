// 1. KEEP YOUR SHIM (It is working!)
require("./shim");

import { AppRegistry } from "react-native";
import App from "./App";

// 3. FORCE THE NAME "main"
// The error explicitly said it couldn't find "main", so we give it "main".
AppRegistry.registerComponent("main", () => App);
