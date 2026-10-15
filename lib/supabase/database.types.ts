import type {
  PhotoGraphEdgeRow,
  PhotoGraphNeighborRow,
  PhotoGraphNodeRow,
  PhotoGraphSettingRow,
} from "@/lib/photo-graph/types";

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type SupabaseDatabase = {
  public: {
    Tables: {
      photo_graph_nodes: TableDefinition<
        PhotoGraphNodeRow,
        Omit<PhotoGraphNodeRow, "created_at">,
        Partial<Omit<PhotoGraphNodeRow, "created_at">>
      >;
      photo_graph_media_cleanup_jobs: TableDefinition<
        {
          id: number;
          node_id: number;
          storage_provider: "r2";
          storage_path: string;
          created_at: string;
          completed_at: string | null;
        },
        { node_id: number; storage_provider: "r2"; storage_path: string },
        { completed_at?: string | null }
      >;
      photo_graph_edges: TableDefinition<
        PhotoGraphEdgeRow,
        Omit<PhotoGraphEdgeRow, "created_at">,
        Partial<Omit<PhotoGraphEdgeRow, "created_at">>
      >;
      photo_graph_neighbors: TableDefinition<
        PhotoGraphNeighborRow,
        PhotoGraphNeighborRow,
        Partial<PhotoGraphNeighborRow>
      >;
      photo_graph_settings: TableDefinition<
        PhotoGraphSettingRow,
        PhotoGraphSettingRow,
        Partial<PhotoGraphSettingRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      queue_photo_graph_r2_deletion: {
        Args: { p_node_id: number };
        Returns: number;
      };
      begin_photo_graph_upload: {
        Args: {
          upload_id: string;
          admin_id: string;
          upload_payload: unknown;
          id_floor: number;
        };
        Returns: unknown;
      };
      photo_graph_upload_revision: {
        Args: Record<string, never>;
        Returns: string;
      };
      commit_photo_graph_upload: {
        Args: {
          upload_id: string;
          expected_revision: string;
          node_rows: unknown;
          source_ids: number[];
          neighbor_rows: unknown;
          generation_config: unknown;
          upload_result: unknown;
        };
        Returns: unknown;
      };
      reserve_photo_graph_node_ids: {
        Args: { requested_count: number };
        Returns: number[];
      };
      replace_photo_graph_neighbor_snapshot: {
        Args: {
          source_ids: number[];
          neighbor_rows: unknown;
          generation_config: unknown;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
