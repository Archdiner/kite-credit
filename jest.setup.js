
require("@testing-library/jest-dom");
const { TextEncoder, TextDecoder } = require("util");

Object.assign(global, { TextEncoder, TextDecoder });
