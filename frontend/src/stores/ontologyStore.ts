import { create } from 'zustand';
import { ontologyApi } from '@/services/api';
import type { ObjectType, LinkType } from '@/types';

interface OntologyState {
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  loading: boolean;
  fetchObjectTypes: () => Promise<void>;
  fetchLinkTypes: () => Promise<void>;
  fetchAll: () => Promise<void>;
}

export const useOntologyStore = create<OntologyState>((set) => ({
  objectTypes: [],
  linkTypes: [],
  loading: false,

  fetchObjectTypes: async () => {
    set({ loading: true });
    try {
      const { data } = await ontologyApi.listObjectTypes();
      set({ objectTypes: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchLinkTypes: async () => {
    const { data } = await ontologyApi.listLinkTypes();
    set({ linkTypes: data });
  },

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [types, links] = await Promise.all([
        ontologyApi.listObjectTypes(),
        ontologyApi.listLinkTypes(),
      ]);
      set({ objectTypes: types.data, linkTypes: links.data });
    } finally {
      set({ loading: false });
    }
  },
}));
