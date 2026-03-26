import { useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, ShoppingBagIcon, StoreIcon, SettingsIcon } from '@/components/icons';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/hooks/use-toast';

interface NavItem {
  path: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/buyer', label: 'Buy', icon: ShoppingBagIcon, requiresAuth: true },
  { path: '/seller', label: 'Sell', icon: StoreIcon, requiresAuth: true },
  { path: '/login', label: 'Account', icon: SettingsIcon },
];

export function BottomNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useSupabaseAuth();
  const { toast } = useToast();

  // Hide on dashboard pages that have their own sidebar nav
  const hiddenPaths = ['/seller', '/buyer', '/admin'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  const handleNavClick = (item: NavItem) => {
    if (item.requiresAuth && !isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please sign in to access this feature.',
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }
    navigate(item.path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border shadow-lg md:hidden"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[56px] min-w-[48px] transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Icon size={22} className={isActive ? 'text-primary' : ''} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
