'use client';

// Thin wrapper to render the full CreateFabric component directly
import CreateFabricPage from './CreateFabric';
import { Fabric } from '@/types/fabric';

type FabricFormContentProps = {
  fabric: Fabric | null;
  onClose: () => void;
  onSave: (wasEdit: boolean, fabricData?: Fabric | Fabric[]) => void;
  isDarkMode: boolean;
};

export default function FabricFormContent({ fabric, onClose, onSave, isDarkMode }: FabricFormContentProps) {
  // Render the form in embed mode to avoid nested overlays or pages.
  return <CreateFabricPage embedMode fabric={fabric} onClose={onClose} onSave={onSave} />;
}

