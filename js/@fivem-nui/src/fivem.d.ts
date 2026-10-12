/**
 * FiveM injects this into every NUI page. Declared here so the bridge can
 * resolve the owning resource without a hard dependency on FiveM typings.
 */
declare function GetParentResourceName(): string;
