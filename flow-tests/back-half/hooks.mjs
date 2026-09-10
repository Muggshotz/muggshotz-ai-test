export async function resolve(specifier, context, next) {
  if (specifier === 'stripe') return { url: new URL('./fake-stripe.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
