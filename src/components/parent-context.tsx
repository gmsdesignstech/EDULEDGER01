"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import type { DbParentChild } from "@/lib/db";

type ParentContextType = {
  children: DbParentChild[];
  selectedChild: DbParentChild | null;
  selectedChildId: string;
  selectChild: (id: string) => void;
  refreshChildren: () => Promise<void>;
  loading: boolean;
};

const ParentContext = createContext<ParentContextType | null>(null);

export function ParentProvider({
  children: reactChildren,
  initialChildren = [],
}: {
  children: React.ReactNode;
  initialChildren?: DbParentChild[];
}) {
  const [childrenList, setChildrenList] = useState<DbParentChild[]>(initialChildren);
  const [selectedChildId, setSelectedChildId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("eduledger_parent_child");
      if (stored && initialChildren.some((c) => c.id === stored)) return stored;
    }
    return initialChildren[0]?.id || "";
  });
  const [isPending, startTransition] = useTransition();

  const selectedChild = childrenList.find((c) => c.id === selectedChildId) || childrenList[0] || null;

  async function refreshChildren() {
    try {
      const res = await fetch("/api/parent/children");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.children)) {
          setChildrenList(data.children);
          if (!data.children.some((c: DbParentChild) => c.id === selectedChildId)) {
            const nextId = data.children[0]?.id || "";
            setSelectedChildId(nextId);
            if (typeof window !== "undefined") {
              localStorage.setItem("eduledger_parent_child", nextId);
            }
          }
        }
      }
    } catch {
      // ignore transient network errors
    }
  }

  function selectChild(id: string) {
    if (childrenList.some((c) => c.id === id)) {
      startTransition(() => {
        setSelectedChildId(id);
        if (typeof window !== "undefined") {
          localStorage.setItem("eduledger_parent_child", id);
        }
      });
    }
  }

  useEffect(() => {
    if (!initialChildren.length) {
      refreshChildren();
    }
  }, []);

  return (
    <ParentContext.Provider
      value={{
        children: childrenList,
        selectedChild,
        selectedChildId: selectedChild?.id || "",
        selectChild,
        refreshChildren,
        loading: isPending,
      }}
    >
      {reactChildren}
    </ParentContext.Provider>
  );
}

export function useParentContext() {
  const ctx = useContext(ParentContext);
  if (!ctx) {
    throw new Error("useParentContext must be used within a ParentProvider");
  }
  return ctx;
}

