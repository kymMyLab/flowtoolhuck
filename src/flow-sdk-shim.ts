// Google Flow SDK Global Proxy Shim
export const Flow: any = new Proxy(
  {},
  {
    get(_target, prop) {
      const globalFlow = typeof window !== 'undefined' ? (window as any).Flow : undefined;
      if (globalFlow && prop in globalFlow) {
        const val = globalFlow[prop];
        return typeof val === 'function' ? val.bind(globalFlow) : val;
      }
      return undefined;
    },
  }
);
export default Flow;

