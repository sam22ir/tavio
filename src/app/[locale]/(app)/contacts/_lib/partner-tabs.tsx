'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/tabs';

interface PartnerTabsProps {
  infoLabel: string;
  editLabel: string;
  info: ReactNode;
  edit: ReactNode;
}

export function PartnerTabs({ infoLabel, editLabel, info, edit }: PartnerTabsProps) {
  return (
    <Tabs defaultValue="info" className="flex flex-col gap-4">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="info">{infoLabel}</TabsTrigger>
        <TabsTrigger value="edit">{editLabel}</TabsTrigger>
      </TabsList>
      <TabsContent value="info">{info}</TabsContent>
      <TabsContent value="edit">{edit}</TabsContent>
    </Tabs>
  );
}
