import { useState } from 'react';
import { CopyIcon, RefreshCwIcon, TrashIcon, PlusIcon, CheckIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  type: 'transfer' | 'webhook' | 'readonly' | 'full';
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export function AdminIntegrations() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Transfer API - Production',
      key: 'pk_live_xxxxxxxxxxxxxxxxxxxx',
      type: 'transfer',
      createdAt: '2026-01-15',
      lastUsed: '2026-02-02',
      isActive: true,
    },
    {
      id: '2',
      name: 'Webhook Integration',
      key: 'wh_xxxxxxxxxxxxxxxxxxxx',
      type: 'webhook',
      createdAt: '2026-01-20',
      isActive: true,
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<ApiKey['type']>('transfer');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const generateApiKey = (type: string) => {
    const prefixes: Record<string, string> = {
      transfer: 'tr',
      webhook: 'wh',
      readonly: 'ro',
      full: 'fa',
    };
    const prefix = prefixes[type] || 'pk';
    const randomPart = Array.from({ length: 32 }, () => 
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
    return `${prefix}_live_${randomPart}`;
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;

    const newKey = generateApiKey(newKeyType);
    const apiKey: ApiKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key: newKey,
      type: newKeyType,
      createdAt: new Date().toISOString().split('T')[0],
      isActive: true,
    };

    setApiKeys(prev => [...prev, apiKey]);
    setGeneratedKey(newKey);
    setNewKeyName('');
  };

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = (id: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const handleRegenerate = (id: string) => {
    setApiKeys(prev => prev.map(k => {
      if (k.id === id) {
        return { ...k, key: generateApiKey(k.type) };
      }
      return k;
    }));
  };

  const keyTypeLabels: Record<ApiKey['type'], { label: string; description: string; color: string }> = {
    transfer: { label: 'Transfer API', description: 'For payment transfers and payouts', color: 'bg-blue-100 text-blue-800' },
    webhook: { label: 'Webhook', description: 'For receiving event notifications', color: 'bg-purple-100 text-purple-800' },
    readonly: { label: 'Read Only', description: 'For viewing data only', color: 'bg-gray-100 text-gray-800' },
    full: { label: 'Full Access', description: 'Complete API access', color: 'bg-red-100 text-red-800' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">API Integrations</h2>
          <p className="text-muted-foreground mt-1">
            Generate and manage API keys for third-party integrations
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <PlusIcon size={16} className="mr-2" />
          Generate New Key
        </Button>
      </div>

      {/* API Keys List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Active API Keys</h3>
        </div>
        
        {apiKeys.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No API keys generated yet.</p>
            <p className="text-sm mt-1">Click "Generate New Key" to create one.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="p-4 hover:bg-muted/20 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-foreground">{apiKey.name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${keyTypeLabels[apiKey.type].color}`}>
                        {keyTypeLabels[apiKey.type].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono text-muted-foreground">
                        {apiKey.key.slice(0, 12)}{'•'.repeat(20)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(apiKey.key, apiKey.id)}
                        className="h-8 w-8 p-0"
                      >
                        {copiedId === apiKey.id ? (
                          <CheckIcon size={14} className="text-green-600" />
                        ) : (
                          <CopyIcon size={14} />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Created: {apiKey.createdAt}</span>
                      {apiKey.lastUsed && <span>Last used: {apiKey.lastUsed}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerate(apiKey.id)}
                      className="text-xs"
                    >
                      <RefreshCwIcon size={14} className="mr-1" />
                      Regenerate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(apiKey.id)}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <TrashIcon size={14} className="mr-1" />
                      Revoke
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Docs */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold text-foreground mb-4">Integration Types</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(keyTypeLabels).map(([type, info]) => (
            <div key={type} className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${info.color}`}>
                  {info.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{info.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {generatedKey ? 'API Key Generated' : 'Generate New API Key'}
            </h3>
            
            {generatedKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium mb-2">
                    ⚠️ Copy this key now. You won't be able to see it again!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-white px-3 py-2 rounded font-mono break-all">
                      {generatedKey}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(generatedKey, 'new')}
                    >
                      {copiedId === 'new' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    </Button>
                  </div>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => {
                    setShowCreateModal(false);
                    setGeneratedKey(null);
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production Transfer API"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label>Key Type</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(keyTypeLabels).map(([type, info]) => (
                      <button
                        key={type}
                        onClick={() => setNewKeyType(type as ApiKey['type'])}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          newKeyType === type
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className={`text-xs px-2 py-0.5 rounded-full ${info.color}`}>
                          {info.label}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewKeyName('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim()}
                  >
                    Generate Key
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
