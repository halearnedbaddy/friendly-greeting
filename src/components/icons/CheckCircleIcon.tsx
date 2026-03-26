import { forwardRef } from 'react';
import { CheckCircle } from 'lucide-react';

export const CheckCircleIcon = forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<typeof CheckCircle>
>((props, ref) => {
  return <CheckCircle ref={ref} {...props} />;
});

CheckCircleIcon.displayName = 'CheckCircleIcon';
