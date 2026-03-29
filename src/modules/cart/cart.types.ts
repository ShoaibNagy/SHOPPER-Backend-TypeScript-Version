export interface CartItem {
    productId: string;
    name: string;
    image: string;
    new_price: number;
    quantity: number;
    subtotal: number;
  }
  
  export interface CartResponse {
    items: CartItem[];
    totalItems: number;
    totalPrice: number;
  }
  
  export interface AddToCartDTO {
    productId: string;
    quantity?: number; // defaults to 1
  }
  
  export interface RemoveFromCartDTO {
    productId: string;
    quantity?: number; // defaults to 1; pass -1 to remove the item entirely
  }
  
  export interface UpdateCartItemDTO {
    productId: string;
    quantity: number; // absolute quantity to set — 0 removes the item
  }