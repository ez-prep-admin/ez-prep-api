export function createObserveModule() {
  return {
    ObserveModule: {
      forRoot: () => ({
        module: class ObserveRootModule {},
      }),
    },
    ObserveInstrument: class ObserveInstrument {},
  };
}
