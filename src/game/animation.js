// Presentation-only helpers. Gameplay modules signal an action; this module decides
// the markup that CSS animates. Final sprites can replace this component later.
export function characterMarkup({ state = "idle", direction = "right", avatar = "male" } = {}) {
  return `
    <span class="farmer farmer--${avatar} farmer--${state} farmer--facing-${direction}" aria-hidden="true">
      <i class="farmer__hat"></i>
      <i class="farmer__hair"></i>
      <i class="farmer__head"></i>
      <i class="farmer__body"></i>
      <i class="farmer__arm farmer__arm--left"></i>
      <i class="farmer__arm farmer__arm--right"></i>
      <i class="farmer__leg farmer__leg--left"></i>
      <i class="farmer__leg farmer__leg--right"></i>
    </span>
  `;
}

export function rewardBurstMarkup() {
  return `<span class="reward-burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`;
}
