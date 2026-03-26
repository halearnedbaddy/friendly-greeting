import { forwardRef } from 'react';
import { X } from 'lucide-react';

export const XIcon = forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<typeof X>
>((props, ref) => {
  return <X ref={ref} {...props} />;
});

XIcon.displayName = 'XIcon';
