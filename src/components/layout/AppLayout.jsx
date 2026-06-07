import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { useAppAuth } from '@/lib/AppAuthContext';
import RealtimeSync from '@/components/RealtimeSync';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export default function AppLayout() {
  const { appUser } = useAppAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <RealtimeSync />
      <Sidebar appUser={appUser} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8 min-h-full pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ minHeight: 0 }}
            >
              <Outlet context={{ appUser }} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
