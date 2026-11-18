import type { ReactNode } from 'react';

export default function Modal({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="modal on">
      <div className="box" style={narrow ? { maxWidth: 400 } : undefined}>
        {children}
      </div>
    </div>
  );
}
