export interface WorkflowPluginRegistry {
  /**
   * Returns true if the task type is known/registered.
   *
   * Task types use the format: namespace/plugin.action
   */
  hasTaskType(type: string): boolean;
}
