export interface WorkflowPermissions {
  security?: 'trusted' | 'restricted'
  permissions?: {
    network?: string[]
    filesystem?: {
      read?: string[]
      write?: string[]
    }
  }
}

export function parsePermissions(workflowConfig: any): WorkflowPermissions {
  return {
    security: workflowConfig.security || 'trusted',
    permissions: workflowConfig.permissions
  }
}

export function validatePermissions(permissions: WorkflowPermissions): void {
  if (permissions.security === 'restricted') {
    if (!permissions.permissions) {
      throw new Error('Restricted mode requires permissions to be declared')
    }
  }
}