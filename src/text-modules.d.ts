// esbuild loads these as text (see esbuild.config.mjs), and vitest mirrors it.
declare module "*.yaml" {
  const text: string;
  export default text;
}
declare module "*.css" {
  const text: string;
  export default text;
}
