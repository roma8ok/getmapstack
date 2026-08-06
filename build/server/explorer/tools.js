import { routingTools } from "./tools/routing.js";
import { geocodingTools } from "./tools/geocoding.js";
import { mapTools } from "./tools/map.js";

// A tool is one object. id and label are UI, group orders the strip, method/path go
// into the parameter card header, minPoints/maxPoints drive the point set, build()
// turns the current state into a request, render() draws the answer, curl() writes
// the copyable command. Nothing else in the page knows what a tool is.
export const TOOLS = [...routingTools, ...geocodingTools, ...mapTools];
