const fs = require("fs");
const path = "assets/index-Nk5hQ9Fp.css";
let c = fs.readFileSync(path, "utf8");
const before = c.length;

c = c.replace(/@font-face\{font-family:rawline;[^}]+\}/g, "");

const fallback = "'Open Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
const stacks = [
  ["rawline,Rawline,serif!important", `${fallback}!important`],
  ["rawline,Rawline,serif", fallback],
  ["Rawline,system-ui,sans-serif", fallback],
  ["font-family:rawline", `font-family:${fallback}`],
  ["font-family:Rawline", `font-family:${fallback}`],
];

for (const [from, to] of stacks) {
  c = c.split(from).join(to);
}

fs.writeFileSync(path, c, "utf8");
console.log("Removed bytes:", before - c.length);
console.log("rawline remaining:", (c.match(/rawline|Rawline/gi) || []).length);
