import MessageBox from '@/components/msgbox'
import { getItemDependencies, type Item } from '@/api/items'

export type Dependency = Partial<Item> & { 
  id: number; 
  name: string; 
  version?: number; 
}

export function useDependencyCheck() {
  /**
   * Check if the item has dependencies and show a confirmation dialog.
   * @param item The item or item ID to check
   * @param options Configuration for the dialog
   * @returns Promise<boolean> True if no dependencies or user confirmed, false otherwise
   */
  const checkDependencies = async (
    item: Item | number, 
    options: { 
      title?: string; 
      messagePrefix?: string;
      messageSuffix?: string;
    } = {}
  ) => {
    const { 
      title = '运行依赖提示', 
      messagePrefix = '此作品运行需要以下依赖，请确保它们已启用',
      messageSuffix = '是否继续？'
    } = options

    const itemId = typeof item === 'number' ? item : item.id;
    let allDependencies: Item[] = [];

    try {
      // Get all recursive dependencies from backend
      const res = await getItemDependencies(itemId);
      allDependencies = res.data;
    } catch (error) {
      console.error('Failed to fetch recursive dependencies:', error);
      // Fallback to item's local dependencies if available
      if (typeof item !== 'number' && item.dependencies) {
        allDependencies = item.dependencies;
      }
    }

    if (allDependencies.length > 0) {
      const depNames = allDependencies.map(d => `• ${d.name} (v${d.version || 1})`).join('\n')
      const confirmed = await MessageBox.confirm(
        `${messagePrefix}：\n\n${depNames}\n\n${messageSuffix}`,
        title
      )
      return !!confirmed
    }
    return true
  }

  return {
    checkDependencies
  }
}
