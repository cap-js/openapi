module.exports = { cdsName, nameFromPath, pathAndMethod, serviceName };

function cdsName(oasName) {
  if (oasName === "") return "_";
  if (typeof oasName === "number") return `_${JSON.stringify(oasName)}`;
  let name = oasName;
  if (
    !name.startsWith("_") &&
    name.match(/^(\p{Nd}|\p{Mn}|\p{Mc}|\p{Pc}|\p{Cf})/u)
  )
    name = "_" + name;
  return name.replace(/[^_\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}]/gu, "_");
  //TODO: shorten if longer than 128 characters
}

function nameFromPath(path, method) {
  let cleanPath = path
    .substring(1)
    .replace(/\/$/, "")
    .replace(/{[^}]+}/g, ".")
    .replace(/\/\./g, "_")
    .replace(/[^_\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}]/gu, "_");
  if (cleanPath === "") cleanPath = "_root";
  //TODO: shorten if longer than 128 characters
  return method === "get" ? cleanPath : `${cleanPath}_${method}`;
}

function pathAndMethod(operation) {
  const path = operation["@openapi.path"];
  const method =
    operation.kind === "function"
      ? "GET"
      : operation["@openapi.method"] || "POST";
  return { path, method };
}

function serviceName(title) {
  return title
    .trim()
    .replace(/(\s|-)+/g, ".")
    .replace(/[^._\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}]/gu, "_");
  //TODO: shorten if longer than 511-129=382 characters
}
