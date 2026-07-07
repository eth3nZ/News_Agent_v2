"""Tests for final industry source balancing."""

from pipeline.modes.industry_mode.source_balancer import balance_industry_source_mix


def make_story(source_name, final_score):
    return {
        "title": f"{source_name} story {final_score}",
        "source_name": source_name,
        "source_url": "",
        "final_score": final_score,
    }


def test_final_industry_mix_targets_7_to_3_when_available():
    stories = []
    for i in range(20):
        stories.append(make_story("TechCrunch", 100 - i))
    for i in range(20):
        stories.append(make_story("36氪", 80 - i))

    result = balance_industry_source_mix(stories, 15)

    domestic = [s for s in result if s["source_name"] == "36氪"]
    foreign = [s for s in result if s["source_name"] == "TechCrunch"]
    assert len(result) == 15
    assert len(foreign) == 10
    assert len(domestic) == 5


def test_final_industry_mix_fills_shortage_by_score():
    stories = [make_story("36氪", 100)]
    stories.extend(make_story("TechCrunch", 90 - i) for i in range(20))

    result = balance_industry_source_mix(stories, 15)

    assert len(result) == 15
    assert sum(1 for s in result if s["source_name"] == "36氪") == 1
