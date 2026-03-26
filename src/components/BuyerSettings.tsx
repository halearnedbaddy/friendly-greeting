import { Bell, Lock, User, Shield, Save } from 'lucide-react';

export function BuyerSettings() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 px-2">
            <h2 className="text-2xl font-bold text-foreground mb-6">Account Settings</h2>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="md:col-span-1">
                    <div className="bg-card rounded-xl border border-border p-6 text-center">
                        <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-50 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl">
                            JD
                        </div>
                        <h3 className="font-bold text-lg text-foreground">John Doe</h3>
                        <p className="text-muted-foreground text-sm mb-4">Joined Dec 2023</p>
                        <button className="text-primary text-sm font-semibold hover:underline">Change Avatar</button>
                    </div>
                </div>

                {/* Form Sections */}
                <div className="md:col-span-2 space-y-6">
                    {/* Personal Info */}
                    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <User className="text-primary" size={20} />
                            <h3 className="font-bold text-lg text-foreground">Personal Information</h3>
                        </div>

                        <div className="grid gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">First Name</label>
                                    <input type="text" defaultValue="John" className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Last Name</label>
                                    <input type="text" defaultValue="Doe" className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                                <input type="email" defaultValue="john.doe@example.com" className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Phone Number (M-Pesa)</label>
                                <input type="tel" defaultValue="+254 7XX XXX XXX" className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Bell className="text-primary" size={20} />
                            <h3 className="font-bold text-lg text-foreground">Notifications</h3>
                        </div>

                        <div className="space-y-4">
                            {['Order Updates', 'Promotions & Deals', 'Security Alerts'].map((item) => (
                                <div key={item} className="flex items-center justify-between">
                                    <span className="text-foreground">{item}</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" defaultChecked className="sr-only peer" />
                                        <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Security */}
                    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="text-primary" size={20} />
                            <h3 className="font-bold text-lg text-foreground">Security</h3>
                        </div>
                        <button className="flex items-center gap-2 text-primary font-semibold hover:underline">
                            <Lock size={16} /> Change Password
                        </button>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition flex items-center gap-2">
                            <Save size={18} /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
