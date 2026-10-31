/** One document per deployment database. */
export const INSTANCE_CONFIG_ID = 'singleton';

/** Bump when the stored shape changes in a way readers must handle. */
export const INSTANCE_CONFIG_SCHEMA_VERSION = 1;

/** Frozen operations and redis overrides, loaded once per process. */
export const INSTANCE_RUNTIME_SNAPSHOT = Symbol('INSTANCE_RUNTIME_SNAPSHOT');
