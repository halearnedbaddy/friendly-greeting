import { forwardRef } from 'react';
import { Shield } from 'lucide-react';

export const ShieldIcon = forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<typeof Shield>
>((props, ref) => {
  return <Shield ref={ref} {...props} />;
});

ShieldIcon.displayName = 'ShieldIcon';
