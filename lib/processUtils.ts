// Process utilities and constants for the CRM system

// Default process priorities based on your requirements
// Higher number = higher priority
export const DEFAULT_PROCESS_PRIORITIES = {
  'Lot No Greigh': 1,
  'Charkha': 2,
  'Drum': 3,
  'Soflina WR': 4,
  'long jet': 5,
  'setting': 6,
  'In Dyeing': 7,
  'jigar': 8,
  'in printing': 9,
  'loop': 10,
  'washing': 11,
  'Finish': 12,
  'folding': 13,
  'ready to dispatch': 14,
  'In House': 15  // Highest priority - shows first
} as const;

// Process names as array for easy iteration
export const PROCESS_NAMES = Object.keys(DEFAULT_PROCESS_PRIORITIES) as Array<keyof typeof DEFAULT_PROCESS_PRIORITIES>;

// Interface for process data
export interface ProcessData {
  name: string;
  priority: number;
  description?: string;
}

// Interface for process with additional metadata
export interface ProcessWithMetadata extends ProcessData {
  id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Utility function to get process priority
export function getProcessPriority(processName: string): number {
  return DEFAULT_PROCESS_PRIORITIES[processName as keyof typeof DEFAULT_PROCESS_PRIORITIES] || 0;
}

// Utility function to sort processes by priority (highest first)
export function sortProcessesByPriority(processes: string[]): string[] {
  return processes.sort((a, b) => {
    const priorityA = getProcessPriority(a);
    const priorityB = getProcessPriority(b);
    
    // If both have priorities, sort by priority (higher first)
    if (priorityA > 0 && priorityB > 0) {
      return priorityB - priorityA;
    }
    
    // If only one has priority, prioritize it
    if (priorityA > 0 && priorityB === 0) return -1;
    if (priorityA === 0 && priorityB > 0) return 1;
    
    // If neither has priority, sort alphabetically
    return a.localeCompare(b);
  });
}

// Utility function to get highest priority process from a list
export function getHighestPriorityProcess(processes: string[]): string | null {
  if (!processes || processes.length === 0) return null;
  
  const sortedProcesses = sortProcessesByPriority(processes);
  return sortedProcesses[0];
}

// Utility function to get process display name with priority
export function getProcessDisplayName(processName: string, showPriority: boolean = false): string {
  const priority = getProcessPriority(processName);
  if (showPriority && priority > 0) {
    return `${processName} (Priority: ${priority})`;
  }
  return processName;
}

// Utility function to validate process name
export function isValidProcessName(processName: string): boolean {
  return processName.trim().length >= 2 && processName.trim().length <= 100;
}

// Utility function to validate process priority
export function isValidProcessPriority(priority: number): boolean {
  return Number.isInteger(priority) && priority >= 1 && priority <= 100;
}

// Utility function to get process color based on priority
export function getProcessColor(processName: string, isDarkMode: boolean = false): string {
  const priority = getProcessPriority(processName);
  
  // Color mapping based on priority ranges
  if (priority >= 12) {
    // High priority (ready to dispatch, folding, Finish)
    return isDarkMode 
      ? 'bg-green-600/20 text-green-300 border border-green-500/30'
      : 'bg-green-100 text-green-700 border border-green-200';
  } else if (priority >= 8) {
    // Medium-high priority (washing, loop, in printing, jigar)
    return isDarkMode 
      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
      : 'bg-blue-100 text-blue-700 border border-blue-200';
  } else if (priority >= 4) {
    // Medium priority (In Dyeing, setting, long jet, Soflina WR)
    return isDarkMode 
      ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-500/30'
      : 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  } else if (priority >= 1) {
    // Low priority (Drum, Charkha, Lot No Greigh)
    return isDarkMode 
      ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
      : 'bg-orange-100 text-orange-700 border border-orange-200';
  } else {
    // Unknown priority
    return isDarkMode 
      ? 'bg-gray-600/20 text-gray-300 border border-gray-500/30'
      : 'bg-gray-100 text-gray-700 border border-gray-200';
  }
}

// Utility function to get process status text
export function getProcessStatusText(processName: string): string {
  const priority = getProcessPriority(processName);
  
  if (priority >= 12) {
    return 'Near Completion';
  } else if (priority >= 8) {
    return 'In Progress';
  } else if (priority >= 4) {
    return 'Processing';
  } else if (priority >= 1) {
    return 'Initial Stage';
  } else {
    return 'Unknown';
  }
}

// Utility function to create default processes for seeding
export function getDefaultProcessesForSeeding(): ProcessData[] {
  return Object.entries(DEFAULT_PROCESS_PRIORITIES).map(([name, priority]) => ({
    name,
    priority,
    description: `Default process: ${name} with priority ${priority}`
  }));
}

// Utility function to check if a process is in the default list
export function isDefaultProcess(processName: string): boolean {
  return processName in DEFAULT_PROCESS_PRIORITIES;
}

// Utility function to get process progress percentage
export function getProcessProgressPercentage(processName: string): number {
  const priority = getProcessPriority(processName);
  const maxPriority = Math.max(...Object.values(DEFAULT_PROCESS_PRIORITIES));
  
  if (priority === 0) return 0;
  
  return Math.round((priority / maxPriority) * 100);
}

// Export types for use in other files
export type ProcessName = keyof typeof DEFAULT_PROCESS_PRIORITIES;
export type ProcessPriority = typeof DEFAULT_PROCESS_PRIORITIES[ProcessName];
