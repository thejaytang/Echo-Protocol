import { useState } from "react";
import { Gem, X } from "lucide-react";

// Brief 2.4: commercialization pre-seed. No purchase flow, no paywall —
// clicking only shows a "coming soon" notice.
export function SkinBadge() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="skin-badge" onClick={() => setOpen(true)}>
        <Gem size={14} />
        限定任务卡皮肤
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <section className="report-modal" onClick={(event) => event.stopPropagation()}>
            <Gem size={22} />
            <h3>即将上线</h3>
            <p>限定任务卡皮肤正在制作中，上线后可在这里预览和更换外观。</p>
            <button className="primary-button full" onClick={() => setOpen(false)}>
              知道了
            </button>
            <button className="icon-button skin-badge-close" aria-label="关闭" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
