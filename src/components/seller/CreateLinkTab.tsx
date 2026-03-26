import { useState } from 'react';
import { Plus, Link2 } from 'lucide-react';
import { LinkGenerator } from '@/components/LinkGenerator';
import { MyLinksPage } from '@/pages/MyLinksPage';

type SubTab = 'create' | 'my_links';

export function CreateLinkTab() {
  const [subTab, setSubTab] = useState<SubTab>('create');

  return (
    <div className="space-y-6">
      {/* Sub-tabs: Create New | My Links */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('create')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition ${
            subTab === 'create'
              ? 'bg-[#5d2ba3] text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Plus size={18} />
          Create New Link
        </button>
        <button
          onClick={() => setSubTab('my_links')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition ${
            subTab === 'my_links'
              ? 'bg-[#5d2ba3] text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Link2 size={18} />
          My Links
        </button>
      </div>

      {subTab === 'create' && <LinkGenerator />}
      {subTab === 'my_links' && <MyLinksPage />}
    </div>
  );
}
