import { forwardRef } from 'react';
import { ChevronRight } from 'lucide-react';

export const ChevronRightIcon = forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<typeof ChevronRight>
>((props, ref) => {
  return <ChevronRight ref={ref} {...props} />;
});

ChevronRightIcon.displayName = 'ChevronRightIcon';
