import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { 
    Copy, ExternalLink, Trash2, Clock, CheckCircle, 
    MoreVertical, Search, Package, Plus, Minus
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { useCurrency } from '@/hooks/useCurrency';

export function MyLinksPage() {
    const { formatPrice } = useCurrency();
    const [links, setLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [restockModal, setRestockModal] = useState<{ linkId: string; currentQty: number } | null>(null);
    const [restockQty, setRestockQty] = useState(1);
    const [restocking, setRestocking] = useState(false);

    const fetchLinks = async () => {
        setLoading(true);
        try {
            const res = await api.getMyPaymentLinks({ 
                status: filter !== 'ALL' ? filter : undefined 
            });
            if (res.success && res.data) {
                setLinks(res.data as any[]);
            }
        } catch (error) {
            console.error('Failed to fetch links:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLinks();
    }, [filter]);

    const handleCopy = (linkUrl: string, id: string) => {
        navigator.clipboard.writeText(linkUrl);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleStatusUpdate = async (linkId: string, newStatus: string) => {
        if (!confirm(`Are you sure you want to mark this link as ${newStatus.toLowerCase()}?`)) return;
        
        const res = await api.updatePaymentLinkStatus(linkId, newStatus);
        if (res.success) {
            fetchLinks();
        }
    };

    const handleRestock = async () => {
        if (!restockModal || restockQty < 1) return;
        setRestocking(true);
        try {
            const res = await api.restockPaymentLink(restockModal.linkId, restockQty);
            if (res.success) {
                alert(`Successfully restocked to ${restockQty} items`);
                setRestockModal(null);
                setRestockQty(1);
                fetchLinks();
            } else {
                alert(res.error || 'Failed to restock');
            }
        } catch (error) {
            alert('Failed to restock');
        } finally {
            setRestocking(false);
        }
    };

    const filteredLinks = links.filter(link => 
        link.productName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-[#3d1a7a]">My Payment Links</h2>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search links..."
                            className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary w-full md:w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {['ALL', 'ACTIVE', 'SOLD_OUT', 'EXPIRED'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                            filter === f 
                            ? 'bg-[#3d1a7a] text-white' 
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {f.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
                            <div className="flex gap-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-48 bg-gray-100 rounded" />
                                    <div className="h-4 w-24 bg-gray-100 rounded" />
                                    <div className="h-4 w-32 bg-gray-100 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredLinks.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ExternalLink className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No links found</h3>
                    <p className="text-gray-500 mt-1">Create your first payment link to start selling.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredLinks.map((link) => (
                        <div key={link.id} className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 hover:shadow-md transition">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    {link.images && link.images.length > 0 ? (
                                        <img src={link.images[0]} alt="" className="w-16 h-16 object-cover rounded-lg" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <Clock className="text-gray-400" size={24} />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-bold text-gray-900">{link.productName}</h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                            <p className="text-xs text-gray-500">Created {new Date(link.createdAt).toLocaleDateString()}</p>
                                            {link.expiryDate && link.status === 'ACTIVE' && (
                                                <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
                                                    <Clock size={12} />
                                                    Expires {new Date(link.expiryDate).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[#3d1a7a] font-bold">{formatPrice(Number(link.price), link.currency || 'KES')}</span>
                                            <StatusBadge status={link.status} size="sm" />
                                            {link.quantity !== null && link.quantity !== undefined && (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center gap-1">
                                                    <Package size={12} />
                                                    {link.quantity} in stock
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-100 mr-2">
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Clicks</p>
                                            <p className="font-bold text-gray-900">{link.clicks}</p>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200"></div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Sales</p>
                                            <p className="font-bold text-gray-900">{link.purchases}</p>
                                        </div>
                                        <div className="w-px h-8 bg-gray-200"></div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Revenue</p>
                                            <p className="font-bold text-[#3d1a7a]">{formatPrice(Number(link.revenue), link.currency || 'KES')}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleCopy(`${window.location.origin}/buy/${link.id}`, link.id)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${
                                                copiedId === link.id 
                                                ? 'bg-green-500 text-white' 
                                                : 'bg-[#3d1a7a] text-white hover:bg-[#250e52]'
                                            }`}
                                        >
                                            {copiedId === link.id ? <CheckCircle size={16} /> : <Copy size={16} />}
                                            {copiedId === link.id ? 'Copied!' : 'Copy Link'}
                                        </button>
                                        
                                        <div className="relative group">
                                            <button className="p-2 hover:bg-gray-100 rounded-lg transition border border-gray-200">
                                                <MoreVertical size={20} />
                                            </button>
                                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 hidden group-hover:block z-10">
                                                <button 
                                                    onClick={() => window.open(`/buy/${link.id}`, '_blank')}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                    <ExternalLink size={14} /> Preview Link
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setRestockModal({ linkId: link.id, currentQty: link.quantity || 0 });
                                                        setRestockQty(link.quantity || 1);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                    <Package size={14} /> Restock / Update Quantity
                                                </button>
                                                {link.status === 'ACTIVE' && (
                                                    <button 
                                                        onClick={() => handleStatusUpdate(link.id, 'DELETED')}
                                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                    >
                                                        <Trash2 size={14} /> Deactivate Link
                                                    </button>
                                                )}
                                                {(link.status === 'SOLD_OUT' || link.status === 'sold_out') && (
                                                    <button 
                                                        onClick={() => {
                                                            setRestockModal({ linkId: link.id, currentQty: 0 });
                                                            setRestockQty(10);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                                    >
                                                        <Plus size={14} /> Restock & Reactivate
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Restock Modal */}
            {restockModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Update Stock Quantity</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Current quantity: <strong>{restockModal.currentQty}</strong>
                        </p>
                        <div className="flex items-center gap-4 mb-6">
                            <button 
                                onClick={() => setRestockQty(Math.max(1, restockQty - 1))}
                                className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                            >
                                <Minus size={18} />
                            </button>
                            <input 
                                type="number"
                                min="1"
                                value={restockQty}
                                onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="flex-1 text-center text-2xl font-bold border border-gray-200 rounded-lg py-2"
                            />
                            <button 
                                onClick={() => setRestockQty(restockQty + 1)}
                                className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setRestockModal(null)}
                                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleRestock}
                                disabled={restocking}
                                className="flex-1 py-2 rounded-lg bg-[#3d1a7a] text-white hover:bg-[#250e52] disabled:opacity-50"
                            >
                                {restocking ? 'Updating...' : 'Update Quantity'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
