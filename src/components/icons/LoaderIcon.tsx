import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export const LoaderIcon = forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<typeof Loader2>
>((props, ref) => {
  return <Loader2 ref={ref} {...props} />;
});

LoaderIcon.displayName = 'LoaderIcon';
