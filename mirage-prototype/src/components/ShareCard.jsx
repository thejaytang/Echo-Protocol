import { Sparkles, X } from "lucide-react";

// Brief 2.3: share card must NOT include user ID, room number, match ID, or
// real nicknames of other players. Other players are shown anonymized
// (e.g. "神秘玩家 B").
export function ShareCardPreview({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="share-card-modal" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button share-card-close" aria-label="关闭预览" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="share-card-art">
          <p className="share-card-mode">3 人抓伪装者</p>
          <p className="share-card-topic">话题：一次难忘的雨夜</p>
          <h3>你找出了隐藏 AI</h3>
          <ul className="share-card-clues">
            <li>神秘玩家 B 的回答缺少具体细节，被追问后仍含糊其辞</li>
            <li>关键情节描述前后不一致</li>
          </ul>
          <div className="share-card-watermark">
            <Sparkles size={14} />
            图灵迷局
          </div>
        </div>

        <div className="modal-actions">
          <button className="primary-button full" onClick={onClose}>
            保存图片
          </button>
        </div>
      </section>
    </div>
  );
}
