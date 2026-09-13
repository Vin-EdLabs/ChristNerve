import { Outlet } from 'react-router-dom';
import { CartDrawer } from '../marketplace/CartDrawer';

/**
 * Deliberately bare — no PublicNavbar, no marketplace tab bar, no links to `/market`.
 * A shared seller's storefront must be a closed loop: every click a visitor makes here
 * (product cards, "back", pagination) has to stay inside this one seller's shop, never
 * surface the wider marketplace or other members' listings. CartDrawer stays mounted
 * so add-to-cart / checkout still work without pulling in the rest of the market chrome.
 */
export function StorefrontLayout() {
  return (
    <div className="storefront-shell">
      <Outlet />
      <CartDrawer />
    </div>
  );
}

export default StorefrontLayout;
