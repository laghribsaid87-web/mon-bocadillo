import React, { createContext, useContext } from 'react';

const PosContext = createContext(null);

export const PosProvider = ({ children, value }) => {
  return (
    <PosContext.Provider value={value}>
      {children}
    </PosContext.Provider>
  );
};

export const usePosContext = () => {
  const context = useContext(PosContext);
  if (!context) {
    throw new Error('usePosContext must be used within a PosProvider');
  }
  return context;
};
