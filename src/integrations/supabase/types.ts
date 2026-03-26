export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          api_key_last_four: string | null
          business_name: string
          business_type: string | null
          callback_url: string | null
          created_at: string
          email: string
          id: string
          ip_whitelist: string[] | null
          live_api_key_hash: string | null
          min_payout_amount: number | null
          payout_phone: string | null
          payout_verified: boolean | null
          sandbox_api_key: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_key_last_four?: string | null
          business_name?: string
          business_type?: string | null
          callback_url?: string | null
          created_at?: string
          email: string
          id?: string
          ip_whitelist?: string[] | null
          live_api_key_hash?: string | null
          min_payout_amount?: number | null
          payout_phone?: string | null
          payout_verified?: boolean | null
          sandbox_api_key?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_key_last_four?: string | null
          business_name?: string
          business_type?: string | null
          callback_url?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_whitelist?: string[] | null
          live_api_key_hash?: string | null
          min_payout_amount?: number | null
          payout_phone?: string | null
          payout_verified?: boolean | null
          sandbox_api_key?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          last_message_at: string | null
          seller_id: string
          status: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          last_message_at?: string | null
          seller_id: string
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          last_message_at?: string | null
          seller_id?: string
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: string
          read: boolean | null
          sender_id: string | null
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_submissions: {
        Row: {
          admin_notes: string | null
          agreement_signed: boolean | null
          business_cert_name: string | null
          business_cert_url: string | null
          created_at: string | null
          current_step: number | null
          developer_id: string
          director_full_name: string | null
          expected_monthly_volume: string | null
          id: string
          kra_pin: string | null
          national_id_back_name: string | null
          national_id_back_url: string | null
          national_id_front_name: string | null
          national_id_front_url: string | null
          phone_number: string | null
          physical_address: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          signatory_name: string | null
          signed_at: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          use_case_description: string | null
        }
        Insert: {
          admin_notes?: string | null
          agreement_signed?: boolean | null
          business_cert_name?: string | null
          business_cert_url?: string | null
          created_at?: string | null
          current_step?: number | null
          developer_id: string
          director_full_name?: string | null
          expected_monthly_volume?: string | null
          id?: string
          kra_pin?: string | null
          national_id_back_name?: string | null
          national_id_back_url?: string | null
          national_id_front_name?: string | null
          national_id_front_url?: string | null
          phone_number?: string | null
          physical_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          signatory_name?: string | null
          signed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          use_case_description?: string | null
        }
        Update: {
          admin_notes?: string | null
          agreement_signed?: boolean | null
          business_cert_name?: string | null
          business_cert_url?: string | null
          created_at?: string | null
          current_step?: number | null
          developer_id?: string
          director_full_name?: string | null
          expected_monthly_volume?: string | null
          id?: string
          kra_pin?: string | null
          national_id_back_name?: string | null
          national_id_back_url?: string | null
          national_id_front_name?: string | null
          national_id_front_url?: string | null
          phone_number?: string | null
          physical_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          signatory_name?: string | null
          signed_at?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          use_case_description?: string | null
        }
        Relationships: []
      }
      conditions: {
        Row: {
          account_id: string
          config: Json | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          account_id: string
          config?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          account_id?: string
          config?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          average_order_value: number | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          last_order_at: string | null
          phone: string | null
          store_id: string
          total_orders: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          average_order_value?: number | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          phone?: string | null
          store_id: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          average_order_value?: number | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          phone?: string | null
          store_id?: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      disbursements: {
        Row: {
          account_id: string
          amount: number
          completed_at: string | null
          created_at: string
          hold_id: string | null
          id: string
          notes: string | null
          provider_ref: string | null
          recipient_name: string | null
          recipient_phone: string | null
        }
        Insert: {
          account_id: string
          amount: number
          completed_at?: string | null
          created_at?: string
          hold_id?: string | null
          id?: string
          notes?: string | null
          provider_ref?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          completed_at?: string | null
          created_at?: string
          hold_id?: string | null
          id?: string
          notes?: string | null
          provider_ref?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disbursements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "escrow_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursements_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "holds"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          earned_at: string | null
          expires_at: string | null
          id: string
          reference: string | null
          status: string
          type: string
          user_id: string
          withdrawal_id: string | null
          withdrawn_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          earned_at?: string | null
          expires_at?: string | null
          id?: string
          reference?: string | null
          status?: string
          type: string
          user_id: string
          withdrawal_id?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          earned_at?: string | null
          expires_at?: string | null
          id?: string
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
          withdrawal_id?: string | null
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      holds: {
        Row: {
          account_id: string
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          condition_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          expires_at: string | null
          expiry_at: string | null
          id: string
          metadata: Json | null
          net_amount: number | null
          payment_method: string | null
          phone: string | null
          release_method: string | null
          released_at: string | null
          status: string | null
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          condition_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expires_at?: string | null
          expiry_at?: string | null
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          payment_method?: string | null
          phone?: string | null
          release_method?: string | null
          released_at?: string | null
          status?: string | null
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          condition_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expires_at?: string | null
          expiry_at?: string | null
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          payment_method?: string | null
          phone?: string | null
          release_method?: string | null
          released_at?: string | null
          status?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holds_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          account_id: string
          address: string | null
          agreement_pdf_url: string | null
          agreement_signed: boolean | null
          business_cert_url: string | null
          created_at: string
          director_name: string | null
          expected_volume: string | null
          expires_at: string | null
          id: string
          id_document_url: string | null
          kra_pin: string | null
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          address?: string | null
          agreement_pdf_url?: string | null
          agreement_signed?: boolean | null
          business_cert_url?: string | null
          created_at?: string
          director_name?: string | null
          expected_volume?: string | null
          expires_at?: string | null
          id?: string
          id_document_url?: string | null
          kra_pin?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          address?: string | null
          agreement_pdf_url?: string | null
          agreement_signed?: boolean | null
          business_cert_url?: string | null
          created_at?: string
          director_name?: string | null
          expected_volume?: string | null
          expires_at?: string | null
          id?: string
          id_document_url?: string | null
          kra_pin?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string | null
          credit_account: string
          debit_account: string
          description: string | null
          entry_ref: string
          id: string
          metadata: Json | null
          order_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          credit_account: string
          debit_account: string
          description?: string | null
          entry_ref: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          credit_account?: string
          debit_account?: string
          description?: string | null
          entry_ref?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          transaction_type?: string
        }
        Relationships: []
      }
      mpesa_account_balances: {
        Row: {
          available_balance: number | null
          checked_at: string | null
          created_at: string | null
          currency: string | null
          current_balance: number | null
          id: string
          raw_balance_string: string | null
          reserved_balance: number | null
          shortcode: string
        }
        Insert: {
          available_balance?: number | null
          checked_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          raw_balance_string?: string | null
          reserved_balance?: number | null
          shortcode: string
        }
        Update: {
          available_balance?: number | null
          checked_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_balance?: number | null
          id?: string
          raw_balance_string?: string | null
          reserved_balance?: number | null
          shortcode?: string
        }
        Relationships: []
      }
      mpesa_callbacks: {
        Row: {
          callback_type: string
          checkout_request_id: string | null
          created_at: string | null
          id: string
          processed: boolean | null
          request_body: Json
          response_body: Json | null
          result_code: number | null
          result_desc: string | null
          transaction_id: string | null
        }
        Insert: {
          callback_type: string
          checkout_request_id?: string | null
          created_at?: string | null
          id?: string
          processed?: boolean | null
          request_body: Json
          response_body?: Json | null
          result_code?: number | null
          result_desc?: string | null
          transaction_id?: string | null
        }
        Update: {
          callback_type?: string
          checkout_request_id?: string | null
          created_at?: string | null
          id?: string
          processed?: boolean | null
          request_body?: Json
          response_body?: Json | null
          result_code?: number | null
          result_desc?: string | null
          transaction_id?: string | null
        }
        Relationships: []
      }
      mpesa_transactions: {
        Row: {
          amount: number
          callback_data: Json | null
          checkout_request_id: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          merchant_request_id: string | null
          mpesa_receipt_number: string | null
          order_id: string | null
          originator_conversation_id: string | null
          phone_number: string | null
          raw_request: Json | null
          result_code: string | null
          result_desc: string | null
          status: string
          transaction_type: string
          updated_at: string | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          amount?: number
          callback_data?: Json | null
          checkout_request_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          order_id?: string | null
          originator_conversation_id?: string | null
          phone_number?: string | null
          raw_request?: Json | null
          result_code?: string | null
          result_desc?: string | null
          status?: string
          transaction_type: string
          updated_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          amount?: number
          callback_data?: Json | null
          checkout_request_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt_number?: string | null
          order_id?: string | null
          originator_conversation_id?: string | null
          phone_number?: string | null
          raw_request?: Json | null
          result_code?: string | null
          result_desc?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      mpesa_verification_attempts: {
        Row: {
          created_at: string
          customer_phone: string
          daraja_response: Json | null
          error_message: string | null
          id: string
          ip_address: string | null
          order_id: string
          transaction_code: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          customer_phone: string
          daraja_response?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          order_id: string
          transaction_code: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          customer_phone?: string
          daraja_response?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          order_id?: string
          transaction_code?: string
          verification_status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: number | null
          compare_at_price: number | null
          created_at: string
          currency: string | null
          description: string | null
          dimensions: Json | null
          id: string
          images: string[] | null
          name: string
          price: number
          quantity: number | null
          sales_count: number | null
          seo_description: string | null
          seo_title: string | null
          sku: string | null
          slug: string | null
          status: string | null
          store_id: string
          tags: string[] | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          category_id?: number | null
          compare_at_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          images?: string[] | null
          name: string
          price?: number
          quantity?: number | null
          sales_count?: number | null
          seo_description?: string | null
          seo_title?: string | null
          sku?: string | null
          slug?: string | null
          status?: string | null
          store_id: string
          tags?: string[] | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          category_id?: number | null
          compare_at_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          images?: string[] | null
          name?: string
          price?: number
          quantity?: number | null
          sales_count?: number | null
          seo_description?: string | null
          seo_title?: string | null
          sku?: string | null
          slug?: string | null
          status?: string | null
          store_id?: string
          tags?: string[] | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          rating: number | null
          total_reviews: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          rating?: number | null
          total_reviews?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          rating?: number | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          connected: boolean | null
          created_at: string
          id: string
          platform: string
          profile_url: string | null
          store_id: string
          username: string | null
        }
        Insert: {
          connected?: boolean | null
          created_at?: string
          id?: string
          platform: string
          profile_url?: string | null
          store_id: string
          username?: string | null
        }
        Update: {
          connected?: boolean | null
          created_at?: string
          id?: string
          platform?: string
          profile_url?: string | null
          store_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          logo: string | null
          name: string
          plan: string | null
          seller_id: string
          slug: string
          social_links: Json | null
          status: string | null
          theme: Json | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          logo?: string | null
          name: string
          plan?: string | null
          seller_id: string
          slug: string
          social_links?: Json | null
          status?: string | null
          theme?: Json | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          logo?: string | null
          name?: string
          plan?: string | null
          seller_id?: string
          slug?: string
          social_links?: Json | null
          status?: string | null
          theme?: Json | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          cancelled_at: string | null
          checkout_request_id: string | null
          created_at: string | null
          currency: string | null
          expires_at: string | null
          id: string
          mpesa_transaction_id: string | null
          paid_at: string | null
          plan: string
          reference: string | null
          started_at: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          cancelled_at?: string | null
          checkout_request_id?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          id?: string
          mpesa_transaction_id?: string | null
          paid_at?: string | null
          plan?: string
          reference?: string | null
          started_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          cancelled_at?: string | null
          checkout_request_id?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          id?: string
          mpesa_transaction_id?: string | null
          paid_at?: string | null
          plan?: string
          reference?: string | null
          started_at?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          account_id: string
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          accepted_at: string | null
          account_id: string
          amount: number
          buyer_address: string | null
          buyer_email: string | null
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          cancel_url: string | null
          checkout_url: string | null
          completed_at: string | null
          courier_name: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          description: string | null
          estimated_delivery_date: string | null
          external_ref: string | null
          fee_amount: number | null
          fee_percentage: number | null
          id: string
          item_description: string | null
          item_images: string[] | null
          item_name: string | null
          merchant_name: string | null
          metadata: Json | null
          payment_method: string | null
          phone: string | null
          platform_fee: number | null
          product_id: string | null
          provider_ref: string | null
          redirect_url: string | null
          rejected_at: string | null
          rejection_reason: string | null
          seller_id: string | null
          seller_payout: number | null
          shipped_at: string | null
          shipping_notes: string | null
          status: string | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          amount: number
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          cancel_url?: string | null
          checkout_url?: string | null
          completed_at?: string | null
          courier_name?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          description?: string | null
          estimated_delivery_date?: string | null
          external_ref?: string | null
          fee_amount?: number | null
          fee_percentage?: number | null
          id?: string
          item_description?: string | null
          item_images?: string[] | null
          item_name?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone?: string | null
          platform_fee?: number | null
          product_id?: string | null
          provider_ref?: string | null
          redirect_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          seller_id?: string | null
          seller_payout?: number | null
          shipped_at?: string | null
          shipping_notes?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          amount?: number
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          cancel_url?: string | null
          checkout_url?: string | null
          completed_at?: string | null
          courier_name?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          description?: string | null
          estimated_delivery_date?: string | null
          external_ref?: string | null
          fee_amount?: number | null
          fee_percentage?: number | null
          id?: string
          item_description?: string | null
          item_images?: string[] | null
          item_name?: string | null
          merchant_name?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone?: string | null
          platform_fee?: number | null
          product_id?: string | null
          provider_ref?: string | null
          redirect_url?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          seller_id?: string | null
          seller_payout?: number | null
          shipped_at?: string | null
          shipping_notes?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_balance: number | null
          created_at: string
          currency: string | null
          id: string
          pending_balance: number | null
          total_earned: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          pending_balance?: number | null
          total_earned?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          pending_balance?: number | null
          total_earned?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      escrow_holds: {
        Row: {
          account_id: string | null
          amount: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          condition_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          expires_at: string | null
          expiry_at: string | null
          id: string | null
          metadata: Json | null
          payment_method: string | null
          phone: string | null
          release_method: string | null
          released_at: string | null
          status: string | null
          transaction_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          condition_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          expires_at?: string | null
          expiry_at?: string | null
          id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone?: string | null
          release_method?: string | null
          released_at?: string | null
          status?: string | null
          transaction_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          condition_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          expires_at?: string | null
          expiry_at?: string | null
          id?: string | null
          metadata?: Json | null
          payment_method?: string | null
          phone?: string | null
          release_method?: string | null
          released_at?: string | null
          status?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holds_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_status:
        | "EMAIL_UNVERIFIED"
        | "EMAIL_VERIFIED"
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "SUSPENDED"
      app_role: "admin" | "user"
      hold_status: "pending" | "held" | "released" | "cancelled"
      kyc_status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
      ticket_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      ticket_status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: [
        "EMAIL_UNVERIFIED",
        "EMAIL_VERIFIED",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "SUSPENDED",
      ],
      app_role: ["admin", "user"],
      hold_status: ["pending", "held", "released", "cancelled"],
      kyc_status: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
      ticket_priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      ticket_status: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
    },
  },
} as const
